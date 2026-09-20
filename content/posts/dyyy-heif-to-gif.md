{
  "title": "DYYY 的 HEIF 转 GIF：解码、帧时长与相册保存",
  "date": "2026-09-20T00:00:00+08:00",
  "url": "/posts/dyyy-heif-to-gif/",
  "description": "从 DYYY 的表情包保存实现出发，拆解宿主解码器复用、HEIF 容器时长回退，以及 GIF 写入与资源清理。",
  "tags": ["DYYY", "iOS", "Objective-C", "图像处理"],
  "toc": true,
  "draft": false
}

DYYY 的表情包保存，需要把应用内部使用的图片资源转换成方便保存、分享的文件。对于 HEIF 动画，这件事至少有三个环节：**取出帧、确定每帧停留多久、把结果写进 GIF**。取到了图片，并不代表还原了动画；写出了 GIF，也不代表播放节奏正确。

这篇文章梳理项目里的 HEIF 转 GIF 实现。代码以 DYYY 的 [`58fb82d`](https://github.com/Wtrwx/DYYY/commit/58fb82dcd3268a498517f449cb596d82cdb0558b) 为准，重点看 `DYYYUtils.m` 的转换方法和 `DYYYManager.m` 的保存流程。这里记录的是这份源码的行为，不把它当成对所有 HEIF 文件、所有抖音版本的兼容承诺。

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

提交历史里，项目曾在 2025 年 5 月引入、随后移除 `libheif` 相关依赖。到本文对应的版本，转换路径使用的是宿主解码器加 ImageIO。历史能说明实现路线发生过变化，不能直接证明某条路线在所有设备上都更快。

## 最容易丢失的，其实是动画的时间

每帧都有图像，还需要一个停留时长。把所有帧统一设成 `0.1` 秒，虽然能生成动画，却可能让原本快慢交替的动作变成匀速。

DYYY 优先使用 `frame.duration`。当这个值不可用时，再尝试用容器总时长除以帧数；最后才使用默认的 `0.1` 秒。实际判断比这个概括更细：

| 解码器给出的时长 | 当前处理 |
|---|---|
| 有限，且不小于 0.01 秒 | 保留原值 |
| 非有限值或不大于 0，且存在有效总时长 | 使用总时长 ÷ 帧数，再做归一化 |
| 正数，但小于 0.01 秒 | 直接归一化为 0.1 秒 |
| 没有可用回退值 | 归一化为 0.1 秒 |

第三行很容易被忽略。当前代码只在“非有限值或不大于零”时使用总时长回退，**不会把所有小于 0.01 秒的值都替换为平均帧时长**。

对应的核心代码是：

```objc
CGFloat frameDuration = frame.duration;
if ((!isfinite(frameDuration) || frameDuration <= 0) &&
    fallbackFrameDuration > 0) {
    frameDuration = fallbackFrameDuration;
}
CGFloat delay = DYYYUtilsNormalizedDelay(frameDuration);
```

归一化函数则把非有限值和过短的时长改为默认值：

```objc
if (!isfinite(delay) || delay < 0.01f) {
    return kDYYYUtilsDefaultFrameDelay; // 0.1 秒
}
return delay;
```

用一个假设例子说明：如果容器总时长为 2.4 秒、共有 24 帧，而解码器没有提供有效时长，平均回退值就是 0.1 秒。这能提供一个合理的播放节奏，但无法恢复某一帧本来停留 0.3 秒、下一帧只停留 0.05 秒的差异。总时长回退是兜底，不是原始时间轴的完整重建。

## 从 moov / mvhd 读取总时长

回退时长来自对原始数据的解析。`DYYYUtilsParseHEIFDuration` 遍历顶层 box，找到 `moov` 后，由 `DYYYUtilsParseMVHDDuration` 在内部寻找 `mvhd`。

这里没有解码图像，而是在读取时间信息：

```text
总时长（秒） = duration / timescale
平均帧时长   = 总时长 / frameCount
```

当前解析器处理三种 box 长度：普通的 32 位长度、`size == 1` 时的扩展 64 位长度，以及 `size == 0` 时延伸到当前解析范围末尾的长度。读取字段前会检查头部和 payload 是否足够长，并按大端序解释数值。

`mvhd` 的不同版本有不同字段布局。下表中的偏移从 payload 起点算起，包含开头的版本和 flags：

| 版本 | timescale 偏移 | duration 偏移 | duration 长度 |
|---|---:|---:|---:|
| 0 | 12 | 16 | 32 位 |
| 1 | 20 | 24 | 64 位 |

如果没有找到可用信息，解析函数返回 `0`，转换仍可继续使用解码器提供的帧时长或默认值。

这个实现只读取 `moov/mvhd`，没有解析每个轨道的采样时间表，也没有重建逐帧时间轴。因此，不能把它理解为“任何 HEIF 动画都能算出精确时长”。即使读到了总时长，平均分配也只适合做缺失信息时的补救。

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

## 这份实现还需要怎样验证

源码已经能说明帧解码、时长回退、GIF 写入和保存的衔接方式，但不能代替设备测试。本文没有重新编译 DYYY，也没有新增真机兼容性或性能测试结果。

后续验证应重点覆盖这些情况：

- **非匀速动画**：检查有长停顿的帧，确认有效的 `frame.duration` 没有被平均化。
- **缺少时长的资源**：分别检查能读到 `mvhd` 和读不到时，输出采用了哪一级回退。
- **静态或损坏资源**：`frameCount == 1` 仍可能写出单帧 GIF；只检查 `frameCount > 0` 无法证明输出是动图。坏帧也应单独计数。
- **不同宿主版本**：确认 `YYImageDecoder` 和 `bd_webURL` 仍可用，而不是仅凭类名和文件后缀推断支持情况。
- **大文件与并发保存**：观察峰值内存、处理时间、取消行为及临时文件清理。当前转换方法没有独立的取消接口，也没有显式设置帧数、尺寸和输入文件大小上限。

对这个功能而言，最终值得检查的是：保存下来的文件有没有保留动作、节奏是否接近原资源，以及失败时能否明确收尾。文件名变成 `.gif`，只是整个过程的最后一个表面结果。

## 源码与历史

- [转换、解码器调用、时长解析与 GIF 写入：DYYYUtils.m](https://github.com/Wtrwx/DYYY/blob/58fb82dcd3268a498517f449cb596d82cdb0558b/DYYYUtils.m)
- [媒体分流与相册保存：DYYYManager.m](https://github.com/Wtrwx/DYYY/blob/58fb82dcd3268a498517f449cb596d82cdb0558b/DYYYManager.m)
- [评论区保存入口：DYYY.xm](https://github.com/Wtrwx/DYYY/blob/58fb82dcd3268a498517f449cb596d82cdb0558b/DYYY.xm)
- [引入 libheif 相关依赖](https://github.com/Wtrwx/DYYY/commit/bf3665b55ac94eb11534005ba3cac033bede72e1)与[随后移除](https://github.com/Wtrwx/DYYY/commit/6105b567f4446948fdcd081a4a34d5ff0fd8c917)
- [增加 HEIF 总时长回退的提交](https://github.com/Wtrwx/DYYY/commit/95134fe81378226df32b33a5862f97652e9b78be)
