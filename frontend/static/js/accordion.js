// Simple accessible accordion with sliding dropdown effect
(function(){
  function slideDown(el){
    el.hidden = false;
    el.style.height = '0px';
    el.style.overflow = 'hidden';
    el.style.transition = 'height 250ms ease';
    const target = el.scrollHeight;
    requestAnimationFrame(() => {
      el.style.height = target + 'px';
    });
    function onEnd(e){
      if (e.propertyName !== 'height') return;
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.removeEventListener('transitionend', onEnd);
    }
    el.addEventListener('transitionend', onEnd);
  }
  function slideUp(el){
    el.style.overflow = 'hidden';
    el.style.transition = 'height 250ms ease';
    el.style.height = el.scrollHeight + 'px';
    requestAnimationFrame(() => {
      el.style.height = '0px';
    });
    function onEnd(e){
      if (e.propertyName !== 'height') return;
      el.hidden = true;
      el.style.height = '';
      el.style.overflow = '';
      el.style.transition = '';
      el.removeEventListener('transitionend', onEnd);
    }
    el.addEventListener('transitionend', onEnd);
  }

  function initAccordions(){
    document.querySelectorAll('.accordion').forEach(acc => {
      acc.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', function(){
          const item = this.closest('.accordion-item');
          const panel = item.querySelector('.accordion-panel');
          const icon = this.querySelector('.accordion-icon');
          const expanded = this.getAttribute('aria-expanded') === 'true';
          if (expanded) {
            this.setAttribute('aria-expanded','false');
            if (icon) icon.textContent = '▸';
            slideUp(panel);
          } else {
            this.setAttribute('aria-expanded','true');
            if (icon) icon.textContent = '▾';
            slideDown(panel);
          }
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccordions);
  } else {
    initAccordions();
  }
})();
