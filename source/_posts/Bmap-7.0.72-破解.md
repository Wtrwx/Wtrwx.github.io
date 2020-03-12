---
title: Bmap_7.0.72_破解
categories: Android
tags:
  - Android
  - 破解
translate_title: bmap7072crack
date: 2020-02-26 09:29:03
---
> 昨天Bmap突然涨价了，永久会员从6r涨到88r，支持不起了，于是就有了下文…

0. 先使用MT管理器2去除签名校验（懒得手动找了）
1. 找找哪里有这个会员状态的检验
![12.1.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.1.jpg)
![12.2.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.2.jpg)
2. 根据文字定位到布局然后根据id找到点击事件
![12.3.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.3.jpg)
![12.4.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.4.jpg)
![12.5.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.5.jpg)
3. 转成Java观察一下，这里调用了一个`isVipValid`方法（其实不转也看得出来）
![12.6.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.6.jpg)
4. 到这其实就很明显了，直接跳转到`Lme/gfuil/bmap/model/UserInfoModel;`这个类，找到这个`isVipValid`方法，转成Java看一下。
![12.7.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.7.jpg)
![12.8.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.8.jpg)
5. 大致就是本地判断，是VIP返回true，不是VIP返回false。我们直接把判断删掉，然后返回true就可以了。
![12.9.jpg](https://gitee.com/wtrwx/wtrwxIMG/raw/master/12.9.jpg)
```
.method public isVipValid()Z
    .registers 6

    .line 163
    const/4 v0, 0x1
    return v0
.end method
```
6. 打包签名安装，enjoy it！

因为作者也是酷安的个人开发者，所以这次不会发成品，本文也只是对破解思路的记录，请勿用于其他用处。
