// 滚动到指定元素
function scrollToElement(target, offset) {
  var scroll_offset = $(target).offset();
  $('body,html').animate({
    scrollTop: scroll_offset.top + (offset || 0),
    easing: 'swing',
  });
}

// 防抖动函数
function debounce(func, wait, immediate) {
  var timeout;
  return function () {
    var context = this, args = arguments;
    var later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// 顶部菜单的监听事件
function navbarScrollEvent() {
  var navbar = $('#navbar');
  if (navbar.offset().top > 0) {
    navbar.addClass('navbar-custom');
    navbar.removeClass('navbar-dark');
  }
  $(window).scroll(debounce(function () {
    $('.scrolling-navbar')[navbar.offset().top > 50 ? 'addClass' : 'removeClass']('top-nav-collapse');
    if (navbar.offset().top > 0) {
      navbar.addClass('navbar-custom');
      navbar.removeClass('navbar-dark');
    } else {
      navbar.addClass('navbar-dark');
    }
  }, 20));
  $('#navbar-toggler-btn').on('click', function () {
    $('.animated-icon').toggleClass('open');
    $('#navbar').toggleClass('navbar-col-show');
  });
}

// 头图视差的监听事件
function parallaxEvent() {
  var target = $('#background[parallax="true"]');
  var parallax = function () {
    var oVal = $(window).scrollTop() / 5;
    var offset = parseInt($('#board').css('margin-top'));
    var max = 96 + offset;
    if (oVal > max) {
      oVal = max;
    }
    target.css({
      transform: 'translate3d(0,' + oVal + 'px,0)',
      '-webkit-transform': 'translate3d(0,' + oVal + 'px,0)',
      '-ms-transform': 'translate3d(0,' + oVal + 'px,0)',
      '-o-transform': 'translate3d(0,' + oVal + 'px,0)',
    });

    var toc = $('#toc');
    if (toc) {
      $('#toc-ctn').css({
        'padding-top': oVal + 'px',
      });
    }
  };
  if (target.length > 0) {
    parallax();
    $(window).scroll(parallax);
  }
}

// 向下滚动箭头的监听事件
function scrollDownArrowEvent() {
  $('.scroll-down-bar').on('click', function () {
    scrollToElement('#board', -$('#navbar').height());
  });
}

// 向顶部滚动箭头的监听事件
function scrollTopArrowEvent() {
  var topArrow = $('#scroll-top-button');
  if (!topArrow) {
    return;
  }
  var posDisplay = false;
  var scrollDisplay = false;
  // 位置
  var setTopArrowPos = function () {
    var boardRight = document.getElementById('board').getClientRects()[0].right;
    var bodyWidth = document.body.offsetWidth;
    var right = bodyWidth - boardRight;
    posDisplay = right >= 50;
    topArrow.css({
      'bottom': posDisplay && scrollDisplay ? '20px' : '-60px',
      'right': right - 64 + 'px',
    });
  };
  setTopArrowPos();
  $(window).resize(setTopArrowPos);
  // 显示
  var headerHeight = $('#board').offset().top;
  $(window).scroll(debounce(function () {
    var scrollHeight = document.body.scrollTop + document.documentElement.scrollTop;
    scrollDisplay = scrollHeight >= headerHeight;
    topArrow.css({
      'bottom': posDisplay && scrollDisplay ? '20px' : '-60px',
    });
  }, 20));
  // 点击
  topArrow.on('click', function () {
    $('body,html').animate({
      scrollTop: 0,
      easing: 'swing',
    });
  });
}

$(document).ready(function () {
  navbarScrollEvent();
  parallaxEvent();
  scrollDownArrowEvent();
  scrollTopArrowEvent();
  $('.ripple-effect').rkmd_rippleEffect();
});

/* -----------------------------------------------------
  Material Design Buttons
  https://codepen.io/rkchauhan/pen/NNKgJY
  By: Ravikumar Chauhan
  Find me on -
  Twitter: https://twitter.com/rkchauhan01
  Facebook: https://www.facebook.com/ravi032chauhan
  GitHub: https://github.com/rkchauhan
  CodePen: https://codepen.io/rkchauhan
-------------------------------------------------------- */

(function ($) {
  $.fn.rkmd_rippleEffect = function () {
    var btn, self, ripple, size, rippleX, rippleY, eWidth, eHeight;

    btn = $(this).not('[disabled], .disabled');

    btn.on('mousedown', function (e) {
      self = $(this);

      // Disable right click
      if (e.button === 2) {
        return false;
      }

      if (self.find('.ripple').length === 0) {
        self.prepend('<span class="ripple"></span>');
      }
      ripple = self.find('.ripple');
      ripple.removeClass('animated');

      eWidth = self.outerWidth();
      eHeight = self.outerHeight();
      size = Math.max(eWidth, eHeight);
      ripple.css({ 'width': size, 'height': size });

      rippleX = parseInt(e.pageX - self.offset().left) - (size / 2);
      rippleY = parseInt(e.pageY - self.offset().top) - (size / 2);

      ripple.css({ 'top': rippleY + 'px', 'left': rippleX + 'px' }).addClass('animated');

      setTimeout(function () {
        ripple.remove();
      }, 800);

    });
  };
}(jQuery));

