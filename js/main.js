// build time:Thu Apr 02 2020 20:36:38 GMT+0800 (中国标准时间)
function scrollToElement(o,a){var t=$(o).offset();$("body,html").animate({scrollTop:t.top+(a||0),easing:"swing"})}function scrollToBoard(){scrollToElement("#board",-$("#navbar").height())}function debounce(o,a,t){var n;return function(){var e=this,r=arguments;var s=function(){n=null;if(!t)o.apply(e,r)};var l=t&&!n;clearTimeout(n);n=setTimeout(s,a);if(l)o.apply(e,r)}}$(document).ready(function(){var o=$("#navbar");if(o.offset().top>0){o.addClass("navbar-custom");o.removeClass("navbar-dark")}$(window).scroll(function(){$(".scrolling-navbar")[o.offset().top>50?"addClass":"removeClass"]("top-nav-collapse");if(o.offset().top>0){o.addClass("navbar-custom");o.removeClass("navbar-dark")}else{o.addClass("navbar-dark")}});$("#navbar-toggler-btn").on("click",function(){$(".animated-icon").toggleClass("open");$("#navbar").toggleClass("navbar-col-show")});var a=$('#background[parallax="true"]');var t=function(){var o=$(window).scrollTop()/5;var t=parseInt($("#board").css("margin-top"));var n=96+t;if(o>n){o=n}a.css({transform:"translate3d(0,"+o+"px,0)","-webkit-transform":"translate3d(0,"+o+"px,0)","-ms-transform":"translate3d(0,"+o+"px,0)","-o-transform":"translate3d(0,"+o+"px,0)"});var e=$("#toc");if(e){$("#toc-ctn").css({"padding-top":o+"px"})}};if(a.length>0){t();$(window).scroll(t)}$(".scroll-down-bar").on("click",scrollToBoard);var n=$("#scroll-top-button");var e=false;var r=false;var s=function(){var o=document.getElementById("board").getClientRects()[0].right;var a=document.body.offsetWidth;var t=a-o;e=t>=50;n.css({bottom:e&&r?"20px":"-60px",right:t-64+"px"})};s();$(window).resize(s);var l=$("#board").offset().top;$(window).scroll(debounce(function(){var o=document.body.scrollTop+document.documentElement.scrollTop;r=o>=l;n.css({bottom:e&&r?"20px":"-60px"})},20));n.on("click",function(){$("body,html").animate({scrollTop:0,easing:"swing"})})});$(document).ready(function(){$(".ripple-effect").rkmd_rippleEffect()});(function(o){o.fn.rkmd_rippleEffect=function(){var a,t,n,e,r,s,l,i;a=o(this).not("[disabled], .disabled");a.on("mousedown",function(a){t=o(this);if(a.button===2){return false}if(t.find(".ripple").length===0){t.prepend('<span class="ripple"></span>')}n=t.find(".ripple");n.removeClass("animated");l=t.outerWidth();i=t.outerHeight();e=Math.max(l,i);n.css({width:e,height:e});r=parseInt(a.pageX-t.offset().left)-e/2;s=parseInt(a.pageY-t.offset().top)-e/2;n.css({top:s+"px",left:r+"px"}).addClass("animated");setTimeout(function(){n.remove()},800)})}})(jQuery);
//rebuild by neat 