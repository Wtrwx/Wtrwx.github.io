---
title: SNP-Crack
categories: Android
tags:
  - Android
  - 破解
translate_title: snpcrack
date: 2020-02-06 18:17:11
---

写在前面：本文产生的任何损失皆与作者无关！

本文仅适用于**少年派5.2.2以下**的版本。

声明：本教程并不包含恢复少年派服务并正常上课的部分，因为其违反了少年派使用协议，这意味着您进行以下操作后将**不能正常上课**，操作前请三思。

##### 一、准备工作

1.一台带无线网卡的win7及以上的电脑
2.软件 360随身wifi、fiddler、软件白名单不为空的，书包内有网页的少年派账号
3.切换账号bug
4.一个修改好包名为白名单内包名，通过AndroidStudio等工具编译的少年派破解专用app
5.服务器

##### 二、破解

1.利用切换账号bug登入账号。
2.进入书包找到一个。
3.根据网上教程配置好wifi热点和fiddler。
4.将少年派破解专用app上传至服务器。
5.打开网页，打开fiddler，断点设置为before requests。

开启断点，注入以下代码：

`<a download="文件名" href="文件下载接口地址"></a>`

取消断点，传回。
6.Pad上安装专用app，给予设备管理员权限后选择最后一项清除数据。

![5.1.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/5.1.jpg)

![5.2.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/5.2.jpg)

7.等待恢复出厂设置完成，enjoy it!

