(function(){
  // Apply dark mode on load
  const enableDark = localStorage.getItem("moneySkillzDarkMode") === "true";
  if(enableDark) document.body.classList.add("dark-mode");
})();
document.getElementById('dark-mode-toggle').addEventListener('change', function() {
  if(this.checked) {
    document.body.classList.add('dark-mode');
    localStorage.setItem("moneySkillzDarkMode", "true");
  } else {
    document.body.classList.remove('dark-mode');
    localStorage.setItem("moneySkillzDarkMode", "false");
  }
});
