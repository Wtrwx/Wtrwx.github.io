!function (e, t, a) {
  var initCopyCode = function () {
    var copyHtml = '';
    copyHtml += '<button class="copy-btn" data-clipboard-snippet="">';
    copyHtml += '<i class="far fa-copy"></i><span>Copy</span>';
    copyHtml += '</button>';
    $('pre.highlight').wrap($('<div class="code-block"></div>'));
    $('.code-block').prepend(copyHtml);
    var clipboard = new ClipboardJS('.copy-btn', {
      target: function (trigger) {
        return trigger.nextElementSibling;
      },
    });
    clipboard.on('success', function (e) {
      showSnackbar("复制成功");
      setTimeout(function () {
        e.trigger.outerHTML = copyHtml;
      }, 2000);
    });
  };
  var oldLoad = window.onload;
  window.onload = function () {
    initCopyCode();
    oldLoad && oldLoad();
  };
}(window, document);
