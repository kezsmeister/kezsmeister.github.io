document.querySelectorAll('.essay-section').forEach(function(section) {
    var toggle = section.querySelector('.year-toggle');
    var body = section.querySelector('.essay-body');

    toggle.addEventListener('click', function() {
        var isExpanded = this.getAttribute('aria-expanded') === 'true';

        if (isExpanded) {
            body.style.maxHeight = body.scrollHeight + 'px';
            body.offsetHeight;
            body.style.maxHeight = '0';
            body.style.opacity = '0';
            this.setAttribute('aria-expanded', 'false');
        } else {
            body.offsetHeight;
            body.style.maxHeight = body.scrollHeight + 'px';
            body.style.opacity = '1';
            this.setAttribute('aria-expanded', 'true');

            var onEnd = function(e) {
                if (e.propertyName === 'max-height') {
                    body.style.maxHeight = 'none';
                    body.removeEventListener('transitionend', onEnd);
                }
            };
            body.addEventListener('transitionend', onEnd);
        }
    });
});
