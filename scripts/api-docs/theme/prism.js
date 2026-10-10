/* Arc3DLab 轻量 JavaScript 语法高亮（Prism 兼容 token 类名，原创实现）。 */
(function () {
  if (typeof document === "undefined") return

  var KEYWORDS =
    "const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|import|from|export|default|await|async|this|typeof|instanceof|void|in|of|delete|try|catch|finally|throw|yield|static|get|set|readonly|public|private|protected|interface|type|enum|implements"
  var LITERALS = "null|undefined|true|false|NaN|Infinity"
  var GROUP = new RegExp(
    [
      "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)",
      "(\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*'|`(?:\\\\.|[^`\\\\])*`)",
      "\\b(" + LITERALS + ")\\b",
      "\\b(" + KEYWORDS + ")\\b",
      "\\b(\\d+(?:\\.\\d+)?)\\b",
      "([A-Za-z_$][\\w$]*)(?=\\s*\\()",
    ].join("|"),
    "g",
  )

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }

  function highlight(text) {
    return escapeHtml(text).replace(GROUP, function (match, comment, string, literal, keyword, number, fn) {
      if (comment) return '<span class="token comment">' + comment + "</span>"
      if (string) return '<span class="token string">' + string + "</span>"
      if (literal) return '<span class="token boolean">' + literal + "</span>"
      if (keyword) return '<span class="token keyword">' + keyword + "</span>"
      if (number) return '<span class="token number">' + number + "</span>"
      if (fn) return '<span class="token function">' + fn + "</span>"
      return match
    })
  }

  function run() {
    var codes = document.querySelectorAll("pre > code.language-javascript")
    for (var i = 0; i < codes.length; i++) {
      if (codes[i].getAttribute("data-highlighted")) continue
      codes[i].innerHTML = highlight(codes[i].textContent)
      codes[i].setAttribute("data-highlighted", "true")
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run)
  } else {
    run()
  }
})()
