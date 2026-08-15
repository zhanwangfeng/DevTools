/* 导航链接数据与渲染，延迟异步加载；active 由页面 data-active 属性标记 */
(function () {
  var navLinks = [
    { key: "vsplugin", href: "https://marketplace.visualstudio.com/publishers/zhanwangfeng", text: "VSCode 插件", target: "_blank", rel: "noopener" },
    { key: "games", href: "/games/", text: "开源游戏" },
    { key: "apps", href: "/apps/", text: "开源项目" },
    { key: "tools", href: "/index.html", text: "工具箱" },
  ];

  function renderNavLinks() {
    var container = document.getElementById("navLinks");
    if (!container || container.childElementCount) return;
    var activeKey = container.getAttribute("data-active");
    navLinks.forEach(function (link) {
      var a = document.createElement("a");
      a.href = link.href;
      a.className = link.key === activeKey ? "active" : "nav-item";
      a.textContent = link.text;
      if (link.target) {
        a.target = link.target;
        a.rel = link.rel || "noopener";
      }
      container.appendChild(a);
    });
  }

  renderNavLinks();
})();
