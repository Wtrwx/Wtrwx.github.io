<script type="text/javascript">
    (function () {
        var header = document.getElementById("header");
        var bgView = document.getElementById("background");
        if (document.cookie.replace(/(?:(?:^|.*;\s*)night\s*\=\s*([^;]*).*$)|^.*$/, "$1") === '') {
          if (new Date().getHours() > 22 || new Date().getHours() < 6) {
        document.body.classList.add('night');
            document.cookie = "night=1;path=/";
            bgView.style.backgroundImage = ""
            header.style.height = "50%";
            console.log('夜间模式开启');
          } else {
        document.body.classList.remove('night');
            document.cookie = "night=0;path=/";
            bgView.style.backgroundImage = "url(https://gitee.com/wtrwx/wtrwxIMG/raw/master/background.png)"
            header.style.height = "100%";
            console.log('夜间模式关闭');
          }
        } else {
          var night = document.cookie.replace(/(?:(?:^|.*;\s*)night\s*\=\s*([^;]*).*$)|^.*$/, "$1") || '0';
          if (night == '0') {
        document.body.classList.remove('night');
            bgView.style.backgroundImage = "url(https://gitee.com/wtrwx/wtrwxIMG/raw/master/background.png)"
            header.style.height = "100%";
          } else if (night == '1') {
        document.body.classList.add('night');
            header.style.height = "50%";
          }
        }
      })();
      function switchNightMode() {
        var header = document.getElementById("header");
        var bgView = document.getElementById("background");
        var night = document.cookie.replace(/(?:(?:^|.*;\s*)night\s*\=\s*([^;]*).*$)|^.*$/, "$1") || '0';
        if (night == '0') {
        document.body.classList.add('night');
          document.cookie = "night=1;path=/"
          bgView.style.backgroundImage = ""
          header.style.height = "50%";
          console.log('夜间模式开启');
        } else {
        document.body.classList.remove('night');
          document.cookie = "night=0;path=/"
          bgView.style.backgroundImage = "url(https://gitee.com/wtrwx/wtrwxIMG/raw/master/background.png)"
          header.style.height = "100%";
          console.log('夜间模式关闭');
        }
      }
</script>