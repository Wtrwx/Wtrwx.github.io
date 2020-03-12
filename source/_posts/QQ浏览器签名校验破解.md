---
title: QQ浏览器签名校验破解
categories: Android
tags:
  - Android
  - 破解
translate_title: qq-browser-signature-verification-crack
date: 2020-02-04 13:20:55
---

1.Dex1中搜索关键词
`mdc.html5.qq.com/mh?from=`
定位到类

![1.1.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/1.1.jpg)

2.继续搜索关键词
`installedPKGInfo`
定位到方法

![1.2.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/1.2.jpg)

3.按照下图把15、18、20、17行改掉

![1.3.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/1.3.jpg)

4.签名安装即可

注意：当前方法仍有很多问题，比如云服务无法正常使用等，本文仅提供一种思路。

原理：原来判断当前签名!=原签名就会触发警报
现在改为当前签名=原签名触发警报。  

