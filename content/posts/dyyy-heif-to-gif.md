{
  "title": "DYYY 的 HEIF 转 GIF：逐字节解析 mvhd 时长",
  "date": "2026-09-20T00:00:00+08:00",
  "url": "/posts/dyyy-heif-to-gif/",
  "description": "从 box 长度、大端序和 version 0/1 字段布局出发，详细解析 DYYY 如何读取 mvhd，并将容器时长用于 GIF 帧延迟回退。",
  "tags": ["DYYY", "iOS", "Objective-C", "图像处理"],
  "toc": true,
  "draft": false
}

DYYY 的表情包保存，需要把应用内部使用的图片资源转换成方便保存、分享的文件。对于 HEIF 动画，这件事至少有三个环节：**取出帧、确定每帧停留多久、把结果写进 GIF**。取到了图片，并不代表还原了动画；写出了 GIF，也不代表播放节奏正确。

这篇文章重点拆解 HEIF 转 GIF 中的 `mvhd` 时长解析：从原始字节找到容器字段，再把时间单位换成秒，最后接入 GIF 帧延迟回退。代码以本文整理时 DYYY `main` 分支的最新提交 [`6bdc7c3`](https://github.com/Wtrwx/DYYY/commit/6bdc7c35c60620f4e914d07f812b9e9478b86542) 为准，重点看 `DYYYUtils.m` 的转换方法和 `DYYYManager.m` 的保存流程。这里记录的是这份源码的行为，不把它当成对所有 HEIF 文件、所有抖音版本的兼容承诺。

## 从保存入口找到原始数据

DYYY 有不止一条表情保存路径。

评论区的保存入口会从表情模型取得资源 URL，交给 `DYYYManager` 下载。下载完成后，代码通过 `detectFileFormat:` 检查文件头，再决定如何处理：WebP 走 WebP 转换，HEIC/HEIF 走 `convertHeicToGif:completion:`，GIF 则直接进入保存流程。

这一步很有必要：调用时的 `MediaTypeHeic` 是业务传入的类型，不能替代对实际文件的检查。不过，当前文件头识别仍然比较粗——遇到 `ftyp` 后，无法明确区分的品牌也会归到 HEIF。它是面向这条下载链路的格式分流，还不是完整的媒体容器识别器。

另一条路径从正在显示的贴纸视图开始。`isBDImageWithHeifURL:` 检查图片类名是否包含 `BDImage`，确认它响应 `bd_webURL`，并判断 URL 中是否含有 `.heif` 或 `.heic`。随后 `saveHeifSticker:` 取出这个 URL，调用同一个转换方法。

两条入口的区别在于原始数据从哪里来。后面的核心流程一致：

```text
原始资源 URL / 已下载的本地文件
                 ↓
             读取 NSData
                 ↓
       YYImageDecoder 解出动画帧
                 ↓
       确定每帧时长，ImageIO 写 GIF
                 ↓
       PhotoKit 保存，清理临时文件
```

URL 里的后缀只是贴纸入口的启发式判断。如果宿主更换图片类、隐藏资源后缀，或者不再提供 `bd_webURL`，这条入口就需要重新适配。

## 复用宿主解码器，而不是只导出当前画面

转换方法没有把 `stickerView.image` 当成一张普通静态图写出去，而是读取原始数据，交给宿主进程里的 `YYImageDecoder`。

关键在于运行时查找。下面是相关逻辑的节选：

```objc
Class decoderClass = NSClassFromString(@"YYImageDecoder");
if (!decoderClass ||
    ![decoderClass respondsToSelector:@selector(decoderWithData:scale:)]) {
    return nil;
}

id decoderInstance = [(id)decoderClass decoderWithData:data scale:1.0f];
if (![decoderInstance isKindOfClass:decoderClass]) {
    return nil;
}
```

这样做不需要在转换方法里另带一套 HEIF 解码库，但会依赖宿主现有的解码能力。**类名叫 `YYImageDecoder`，不等于任意环境里的同名类都支持这些 HEIF 资源。** 这里借用的是目标应用进程中实际存在的实现。

取得解码器后，代码用 `frameCount` 遍历帧，再调用：

```objc
YYImageFrame *frame = [decoder frameAtIndex:i decodeForDisplay:YES];
CGImageRef imageRef = frame.image.CGImage;
```

`CGImageRef` 才是交给 GIF 写入器的像素图像。当前实现逐帧取得图像并写入，没有先在业务代码里建立一个包含所有帧的 `UIImage` 数组；但原始 `NSData` 和解码器仍在内存中，解码器是否缓存帧也不受这段循环控制，因此不能据此说它是恒定内存的流式转码。

## 从容器字节里找到 mvhd

当解码器能取出帧，却没有提供有效的帧时长时，DYYY 会尝试从原始数据里读取总时长。相关代码集中在三个函数：

```text
DYYYUtilsHEIFDurationFromData(data)
  └─ DYYYUtilsParseHEIFDuration(bytes, length)
       └─ 找到 moov，进入它的 payload
            └─ DYYYUtilsParseMVHDDuration(bytes, length)
                 └─ 找到 mvhd，读取 timescale 和 duration
```

这里的目标是读取资源中可用的 movie header 时间信息。它不负责解码 HEVC 图像，也不会仅凭 `mvhd` 重建每一帧的播放时刻。对于没有这条 box 路径的资源，代码返回 `0`，表示没有取得可用的总时长。

### 先理解 box 的边界

这段解析面对的是按 box 组织的字节数据。普通 box 的开头有 8 个字节：

```text
相对 box 起点的偏移

0               4               8
+---------------+---------------+----------------------+
| size：4 字节  | type：4 字节  | payload ...          |
+---------------+---------------+----------------------+

size 包含头部本身，不只是 payload 的长度。
type 是四字节标识，例如 moov、mvhd、mdat。
```

`position` 表示当前 box 在本层数据中的起点，`length` 表示本层解析范围的长度。读完一个 box 后，游标移动的是完整的 `rawSize`：

```objc
position += (NSUInteger)rawSize;
```

不能每次只加 8，也不能从当前位置一直搜索字符串 `mvhd`。压缩数据内部也可能碰巧出现相同的四个字节；只有从正确的 box 边界读取 type，才能把结构字段和普通数据区分开。

DYYY 在顶层遍历中寻找 `moov`，找到后把它的 payload 交给下一层。内层再遍历 `moov` 的直接子 box，寻找 `mvhd`。两层使用相同的长度处理方式，区别只在于寻找的 type 和找到后的动作。

### size 的三种情况

读取最前面的 32 位 `size` 后，不能立即把它当成最终长度：

| 初始 size | 解释 | 头部长度 |
|---|---|---:|
| 普通长度值 | 整个 box 的字节数 | 8 |
| `1` | 真正长度在后面的 64 位 `largesize` 中 | 16 |
| `0` | 本实现按延伸到当前解析范围末尾处理 | 8 |

扩展长度的布局如下：

```text
0               4               8                       16
+---------------+---------------+-----------------------+----------+
| size = 1      | type          | largesize：8 字节      | payload  |
+---------------+---------------+-----------------------+----------+
```

注意：使用扩展长度时，type 仍在 `+4`，移动的是 payload 起点。源码因此用变量 `header` 保存 8 或 16，而不是写死 `payload = bytes + position + 8`。

代码中的处理是：

```objc
uint64_t rawSize = DYYYUtilsReadUInt32BigEndian(bytes + position);
NSUInteger header = 8;

if (rawSize == 1) {
    if (position + 16 > length) {
        break;
    }
    rawSize = DYYYUtilsReadUInt64BigEndian(bytes + position + 8);
    header = 16;
} else if (rawSize == 0) {
    rawSize = length - position;
}
```

进入 `moov` 的下一层时，传入的是：

```objc
bytes + position + header    // 子范围起点
(NSUInteger)rawSize - header // 子范围长度
```

这样，内层的 `position = 0` 指向 `moov` 中的第一个子 box，而不是再次读取 `moov` 自己。内层也不能越过父 box 的末尾去读取后续顶层数据。

### 多字节整数要按大端序读取

比如四个字节 `00 00 03 E8`，表示整数 `1000`。不能直接把这个地址强转成 `uint32_t *` 再解引用：那会受宿主字节序和内存对齐影响。

DYYY 的 32 位读取函数逐字节移位：

```objc
static uint32_t DYYYUtilsReadUInt32BigEndian(const uint8_t *bytes) {
    return ((uint32_t)bytes[0] << 24)
         | ((uint32_t)bytes[1] << 16)
         | ((uint32_t)bytes[2] << 8)
         |  (uint32_t)bytes[3];
}
```

先转为 `uint32_t`，再移位和按位或，避免让字节值经过不合适的有符号整数运算。64 位版本则从左到右循环：

```objc
uint64_t value = 0;
for (NSUInteger i = 0; i < 8; i++) {
    value = (value << 8) | (uint64_t)bytes[i];
}
```

这两个函数本身没有长度参数，不负责检查能不能读满 4 或 8 字节。边界检查必须由调用方在调用前完成。

### 为什么 version 0 是 +12 和 +16

找到 `mvhd` 后，代码定义：

```objc
const uint8_t *payload = bytes + position + header;
NSUInteger payloadLength = (NSUInteger)rawSize - header;
uint8_t version = payload[0];
```

`mvhd` 的 payload 开头还包含 **1 字节 version + 3 字节 flags**。这 4 字节没有计入前面普通 box 的 8 字节头部。讨论字段偏移时，必须先说清从哪里算起。

version 0 的时间相关字段布局为：

| 相对 payload 的偏移 | 长度 | 字段 |
|---:|---:|---|
| 0 | 1 | version |
| 1 | 3 | flags |
| 4 | 4 | creation_time |
| 8 | 4 | modification_time |
| 12 | 4 | timescale |
| 16 | 4 | duration |

因此，读取时长需要至少 20 字节 payload：

```objc
uint32_t timescale = DYYYUtilsReadUInt32BigEndian(payload + 12);
uint32_t duration  = DYYYUtilsReadUInt32BigEndian(payload + 16);
```

这里的“至少 20 字节”只是**读到 duration 字段所需的最短前缀**，不是一个完整 `mvhd` 的全部长度。后面还有其他字段，当前提取时长的函数不读取它们，也不验证整个 header 的语义。

如果是普通 8 字节 box 头，timescale 位于 box 起点的 `8 + 12 = 20`；如果是 16 字节扩展头，就位于 `16 + 12 = 28`。始终相对 payload 取偏移，可以把这两种头部布局统一起来。

### version 1 为什么要换偏移

version 1 把 creation_time、modification_time 和 duration 扩展成 64 位，timescale 仍然是 32 位。字段布局变成：

| 相对 payload 的偏移 | 长度 | 字段 |
|---:|---:|---|
| 0 | 1 | version |
| 1 | 3 | flags |
| 4 | 8 | creation_time |
| 12 | 8 | modification_time |
| 20 | 4 | timescale |
| 24 | 8 | duration |

读取 duration 的末尾需要到 payload 第 32 字节，所以源码在这个分支单独检查 `payloadLength < 32`，随后读取：

```objc
uint32_t timescale = DYYYUtilsReadUInt32BigEndian(payload + 20);
uint64_t duration  = DYYYUtilsReadUInt64BigEndian(payload + 24);
```

如果仍按 version 0 的偏移读，取到的可能是时间戳字段的一部分，而不是 timescale。这种错误未必立刻崩溃，更可能得到一个看似合法却完全错误的播放时长。

### 用一组字节算一遍

下面是构造的 version 0 **payload 前 20 字节**，只用来说明字段读取，不是完整 HEIF 文件，也不是完整 `mvhd`：

```text
偏移  字节             含义
00    00               version = 0
01    00 00 00         flags
04    00 00 00 00      creation_time（示例占位）
08    00 00 00 00      modification_time（示例占位）
12    00 00 03 E8      timescale = 1000
16    00 00 09 60      duration  = 2400
```

`timescale` 表示一秒对应多少个时间单位，不是帧率。`duration` 使用同一时间单位，所以：

```text
totalSeconds = 2400 / 1000 = 2.4 秒
```

源码先把两个整数转换成 `NSTimeInterval`，再做除法：

```objc
if (timescale > 0) {
    return (NSTimeInterval)duration / (NSTimeInterval)timescale;
}
```

如果先做整数除法再转换，`2400 / 1000` 会先变成 `2`，小数部分就丢了。检查 `timescale > 0` 则是为了避免除零。

假设解码器报告 24 帧，那么写入函数可据此得到 `2.4 / 24 = 0.1` 秒的平均回退值。这个值只有在某帧的解码器时长无效时才会被使用；正常的逐帧时长依然优先。

### 边界检查做到了哪里

当前实现先确认剩余数据足够读取头部，再检查：

```objc
if (rawSize < header || position + rawSize > length) {
    break;
}
```

前半句防止出现“box 总长度比头部还短”的情况；后半句试图确保 box 不越过当前范围。遇到截断或错误长度时，代码停止这一层扫描，不尝试跳到某个猜测位置继续解析。找不到有效结果则返回 `0`。

当前检查使用 `position + rawSize` 判断末尾；这段加法没有单独处理整数溢出，因此不能将它视为对任意恶意输入都完备的边界验证。

这仍不是一个完整的容器校验器。当前代码只关心能够读取时长的那段前缀，没有验证所有后续字段，也没有从轨道采样表恢复逐帧时间。因此应把返回值理解为**这条资源路径下可用的总时长候选值**，并结合实际帧数和输出播放效果验证。

## 总时长怎样接回 GIF 帧时长

`DYYYUtilsHEIFDurationFromData` 返回的值作为 `fallbackTotalDuration` 传给 GIF 写入函数。写入器用解码器的帧数得到平均值，然后逐帧决定采用哪个时长。

| 解码器给出的时长 | 当前处理 |
|---|---|
| 有限，且不小于 0.01 秒 | 保留原值 |
| 非有限值或不大于 0，且存在有效总时长 | 使用总时长 ÷ 帧数，再做归一化 |
| 正数，但小于 0.01 秒 | 直接归一化为 0.1 秒 |
| 没有可用回退值 | 归一化为 0.1 秒 |

对应源码是：

```objc
CGFloat frameDuration = frame.duration;
if ((!isfinite(frameDuration) || frameDuration <= 0) &&
    fallbackFrameDuration > 0) {
    frameDuration = fallbackFrameDuration;
}
CGFloat delay = DYYYUtilsNormalizedDelay(frameDuration);
```

`DYYYUtilsNormalizedDelay` 会把非有限值和小于 `0.01` 秒的值改为 `0.1` 秒。这意味着一个重要细节：**正数但过短的解码器时长，不会先尝试容器平均值，而是直接走默认值。**

另外，平均回退没有做“剩余时长重新分配”。如果只有部分帧缺少时长，代码仍给这些帧使用 `总时长 / 全部帧数`，不会先减掉其他有效帧的时长。由此生成的 GIF 总时长不一定等于 `mvhd` 中读出的总时长。

例如，总时长为 1 秒、两帧中第一帧时长为 0.2 秒、第二帧时长缺失，当前逻辑会给第二帧补 0.5 秒，合计 0.7 秒，而不是 1 秒。这个例子说明了回退的定位：在信息不完整时给出可用估计，不能保证恢复原始时间轴。

## 让 ImageIO 负责 GIF 写入

帧图像和时长准备好后，代码用 `CGImageDestinationCreateWithURL` 创建 GIF 目标，预期图像数量设为解码器的帧数。

全局属性将 `kCGImagePropertyGIFLoopCount` 设为 `0`，表示循环播放。每一帧则把刚才算出的 `delay` 放进 `kCGImagePropertyGIFDelayTime`：

```objc
NSDictionary *frameProps = @{
    (__bridge NSString *)kCGImagePropertyGIFDictionary : @{
        (__bridge NSString *)kCGImagePropertyGIFDelayTime : @(delay)
    }
};
CGImageDestinationAddImage(dest, imageRef,
                          (__bridge CFDictionaryRef)frameProps);
```

这里写入的是普通 GIF delay 属性，没有同时写入 unclamped delay。最终播放速度还要看 GIF 编码和播放器对时长的处理，不能把传入的浮点数等同于最终显示设备上的精确停留时间。

另一个细节是成功条件。代码用 `hasFrame` 记录是否至少写入过一帧，再调用 `CGImageDestinationFinalize`，以它的返回值判断写入结果，最后 `CFRelease` 释放目标对象。

如果某帧没有可用的 `CGImageRef`，循环会跳过它。这样不会把空图像传给写入器，但也意味着成功标志本身不足以证明“原始帧完整保留”：预期帧数仍然是解码器报告的数量，坏帧的时长也没有补偿。要确认输出质量，还应重新读取生成文件，检查帧数和播放时长。

## 转换结束之后，才是相册保存

`convertHeicToGif:completion:` 把数据读取和转码放在全局后台队列，完成回调统一切回主线程。即使传入 URL 为空，失败回调也通过主队列发出，调用方不必根据不同失败路径猜测线程。

输出文件名由原资源名加 UUID 组成，降低并发转换时同名覆盖的风险。转换失败会删除临时输出，并记录失败原因，例如数据为空、解码器不可用、没有帧或者 GIF 写入失败。

`DYYYManager` 承担后续保存流程。在 `saveHeifSticker:` 这条路径中，转换成功后通过 `PHAssetCreationRequest` 把 GIF 文件作为照片资源提交给 PhotoKit。等相册操作回调后，再提示结果并删除临时文件。

这个顺序不能反过来。转换器返回成功，只说明文件已经生成；相册保存是另一个异步操作，过早清理会让保存阶段失去输入文件。代码也分别保留了“转换失败”和“保存失败”的反馈。

## 当前实现的适用范围

这条路径依赖宿主的 `YYImageDecoder` 提供帧图像，并优先采用它的帧时长。`mvhd` 只在时长缺失时提供总时长参考，不替代逐帧时间信息。

解析失败返回 `0`，转换继续尝试解码器时长或默认值；解码器没有帧、没有图像成功写入，或 GIF finalize 失败，则转换返回失败。单帧资源也可能生成单帧 GIF，所以转换成功不等于资源一定包含动画。

当前转换在后台队列执行，没有独立取消接口，也没有显式设置输入大小、帧数和图像尺寸上限。本文说明的是源码中的处理逻辑，不包含新增的真机性能或兼容性测试结果。

## 对应源码

- [转换、解码器调用、时长解析与 GIF 写入：DYYYUtils.m](https://github.com/Wtrwx/DYYY/blob/6bdc7c35c60620f4e914d07f812b9e9478b86542/DYYYUtils.m)
- [媒体分流与相册保存：DYYYManager.m](https://github.com/Wtrwx/DYYY/blob/6bdc7c35c60620f4e914d07f812b9e9478b86542/DYYYManager.m)
- [评论区保存入口：DYYY.xm](https://github.com/Wtrwx/DYYY/blob/6bdc7c35c60620f4e914d07f812b9e9478b86542/DYYY.xm)
