---
title: 一些经常用到的Java代码
tags: Android
categories: Android
translate_title: some-frequently-used-java-code
date: 2020-03-10 22:42:24
---
> 以下代码或来自于网络或是自己原创，未能及时注明原出处。如有侵权，请通过关于页的联系方式联系我。
### 1.检测是否连接代理
``` java
private boolean isWifiProxy(Context context) {
        final boolean IS_ICS_OR_LATER = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.ICE_CREAM_SANDWICH;
        String proxyAddress;
        int proxyPort;
        if (IS_ICS_OR_LATER) {
            proxyAddress = System.getProperty("http.proxyHost");
            String portStr = System.getProperty("http.proxyPort");
            proxyPort = Integer.parseInt((portStr != null ? portStr : "-1"));
        } else {
            proxyAddress = android.net.Proxy.getHost(context);
            proxyPort = android.net.Proxy.getPort(context);
        }
        return (!TextUtils.isEmpty(proxyAddress)) && (proxyPort != -1);
}
```
### 2.控件连续点击事件
``` java
final static int COUNTS = 7;// 点击次数
final static long DURATION = 1500;// 规定有效时间
long[] mHits = new long[COUNTS];
//点击事件
public void onClick(View v) {
	continuousClick(COUNTS, DURATION);
}
private void continuousClick(int count, long time) {
	//每次点击时，数组向前移动一位
	System.arraycopy(mHits, 1, mHits, 0, mHits.length - 1);
	//为数组最后一位赋值
	mHits[mHits.length - 1] = SystemClock.uptimeMillis();
	if (mHits[0] >= (SystemClock.uptimeMillis() - DURATION)) {
		mHits = new long[COUNTS];//重新初始化数组
		Toast.makeText(this, "连续点击了7次", Toast.LENGTH_LONG).show();
	}
}
```
