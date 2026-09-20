{
  "title": "DYYY 的 HEIF 转 GIF：解码、帧时长与相册保存",
  "date": "2026-09-20T00:00:00+08:00",
  "url": "/posts/dyyy-heif-to-gif/",
  "description": "从 DYYY 的表情包保存实现出发，拆解宿主解码器复用、仅保留解码器逐帧时长，以及 GIF 写入与资源清理。",
  "tags": ["DYYY", "iOS", "Objective-C", "图像处理"],
  "toc": true,
  "draft": false
}

DYYY 的表情包保存，需要把应用内部使用的图片资源转换成方便保存、分享的文件。对于 HEIF 动画，这件事至少有三个环节：**取出帧、确定每帧停留多久、把结果写进 GIF**。取到了图片，并不代表还原了动画；写出了 GIF，也不代表播放节奏正确。

这篇文章以 DYYY 的 [`58fb82d`](https://github.com/Wtrwx/DYYY/commit/58fb82dcd3268a498517f449cb596d82cdb0558b) 为起点，梳理解码和保存流程，并调整帧时长策略：**只采用解码器提供的逐帧时长，缺失或无效时终止转换。** 下文的严格时长检查是拟采用的方案；链接中的源码仍包含平均时长和固定默认值回退，尚未按此修改。

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

## 每帧多久，就保留多久

每帧都有图像，还需要一个停留时长。动画里的停顿、加速和重复动作，都依赖这份时间信息。

调整后的方案只使用 `YYImageFrame.duration`。不再读取容器总时长来平均分配，也不再把异常值统一改成 `0.1` 秒。总时长和帧数无法告诉我们每一帧原本停留多久，用平均值填补会丢掉这部分信息。

例如，两帧分别停留 `0.05` 秒和 `0.35` 秒，总时长是 `0.4` 秒。如果改成每帧 `0.2` 秒，总播放时间虽然相同，动作节奏却已经不同。

这里的判断只回答一个问题：解码器是否给出了有效的正数时长？

| 解码器提供的时长 | 处理方式 |
|---|---|
| 有限且大于 0 | 按原值传给 GIF 写入器 |
| 0、负数、NaN 或无穷大 | 终止转换，返回失败并清理临时输出 |

对应的检查可以直接放在写帧循环中。下面是拟采用的逻辑片段，不是现有版本的逐字摘录：

```objc
CGFloat delay = frame.duration;
if (!isfinite(delay) || delay <= 0) {
    // 跳转到统一失败收尾，释放 destination 并删除临时文件。
    success = NO;
    break;
}
```

`success` 需要由完整写入流程管理：只有全部帧都通过检查、全部写入，而且 `CGImageDestinationFinalize` 成功，才能最终置为成功。不能在循环中发现异常后，又用一次 finalize 的结果覆盖失败状态。

这里也不保留旧代码的 `delay < 0.01` → `0.1` 秒规则。只要解码器返回的是有效正数，就不在应用层主动放慢这一帧。不过，GIF 本身的时间表示精度，以及不同播放器对短延迟的处理，仍会影响最终播放效果；把原值传进去，不等于输出端能无限精确地保留它。

这项选择会让部分缺少时长的资源转换失败。失败原因是无法可靠保留时间信息，而不是没有取到图像。调用方应提示“无法读取有效帧时长”，而不是把它笼统归为文件损坏。

## 删除总时长推算这条支路

既然不再使用平均时长，HEIF 转 GIF 路径就不需要解析 `moov/mvhd`。转换器只消费解码器提供的帧图像和帧时长，写入函数也不再需要 `fallbackTotalDuration` 参数。

相对于链接中的基线版本，需要调整的地方是：

- 从 `convertHeicToGif:completion:` 删除 HEIF 总时长读取及传递。
- 从 GIF 写入函数删除总时长除以帧数的计算。
- HEIF 路径不再调用把异常时长归一化为 `0.1` 秒的函数。
- 任意帧图像或时长不可用，都进入统一失败收尾。

当前 GIF 写入辅助函数还被其他转换路径复用。实际修改源码时，应明确严格策略的作用范围，避免顺手改变 WebP 等路径的行为；相关解析函数也应在确认没有其他调用后再移除。本文先确定 HEIF 路径的策略。

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

成功条件也需要随之收紧。基线实现用 `hasFrame` 记录是否至少写入一帧，遇到空图像会跳过；拟采用的方案要求每一帧都有可用图像和有效时长，实际写入数量等于预期帧数，再由 `CGImageDestinationFinalize` 确认输出成功。无论成功或失败，都要 `CFRelease` 释放目标对象。

这样可以避免跳过坏帧后悄悄改变动画时长。验证时还应重新读取生成文件，检查帧数、时长和实际播放效果。

## 转换结束之后，才是相册保存

`convertHeicToGif:completion:` 把数据读取和转码放在全局后台队列，完成回调统一切回主线程。即使传入 URL 为空，失败回调也通过主队列发出，调用方不必根据不同失败路径猜测线程。

输出文件名由原资源名加 UUID 组成，降低并发转换时同名覆盖的风险。转换失败会删除临时输出，并记录失败原因，例如数据为空、解码器不可用、没有帧或者 GIF 写入失败。

`DYYYManager` 承担后续保存流程。在 `saveHeifSticker:` 这条路径中，转换成功后通过 `PHAssetCreationRequest` 把 GIF 文件作为照片资源提交给 PhotoKit。等相册操作回调后，再提示结果并删除临时文件。

这个顺序不能反过来。转换器返回成功，只说明文件已经生成；相册保存是另一个异步操作，过早清理会让保存阶段失去输入文件。代码也分别保留了“转换失败”和“保存失败”的反馈。

## 这份实现还需要怎样验证

本文的严格时长方案尚未落入 DYYY 源码，也尚未进行编译和真机验证。实现后需要检查正常资源能否保留节奏，以及异常资源是否正确失败和清理。

后续验证应重点覆盖这些情况：

- **非匀速动画**：检查长停顿和短动作，确认逐帧时长按解码器原值传入。
- **无效时长**：注入 0、负数、NaN 和无穷大，确认转换失败，不发布残缺 GIF，临时文件得到清理。
- **短时长**：检查小于 `0.01` 秒的有效正数，确认应用层没有替换成 `0.1` 秒，并比较目标播放器的实际表现。
- **静态或损坏资源**：`frameCount == 1` 仍可能写出单帧 GIF；只检查 `frameCount > 0` 无法证明输出是动图。坏帧应触发失败，而不是被静默跳过。
- **不同宿主版本**：确认 `YYImageDecoder` 和 `bd_webURL` 仍可用，而不是仅凭类名和文件后缀推断支持情况。
- **大文件与并发保存**：观察峰值内存、处理时间、取消行为及临时文件清理。当前转换方法没有独立的取消接口，也没有显式设置帧数、尺寸和输入文件大小上限。

对这个功能而言，最终值得检查的是：保存下来的文件有没有保留动作、节奏是否接近原资源，以及失败时能否明确收尾。文件名变成 `.gif`，只是整个过程的最后一个表面结果。

## 源码与历史

- [基线实现：解码器调用、旧时长回退与 GIF 写入（DYYYUtils.m）](https://github.com/Wtrwx/DYYY/blob/58fb82dcd3268a498517f449cb596d82cdb0558b/DYYYUtils.m)
- [媒体分流与相册保存：DYYYManager.m](https://github.com/Wtrwx/DYYY/blob/58fb82dcd3268a498517f449cb596d82cdb0558b/DYYYManager.m)
- [评论区保存入口：DYYY.xm](https://github.com/Wtrwx/DYYY/blob/58fb82dcd3268a498517f449cb596d82cdb0558b/DYYY.xm)
- [引入 libheif 相关依赖](https://github.com/Wtrwx/DYYY/commit/bf3665b55ac94eb11534005ba3cac033bede72e1)与[随后移除](https://github.com/Wtrwx/DYYY/commit/6105b567f4446948fdcd081a4a34d5ff0fd8c917)
- [旧总时长回退的历史提交](https://github.com/Wtrwx/DYYY/commit/95134fe81378226df32b33a5862f97652e9b78be)（本文方案不再采用）
