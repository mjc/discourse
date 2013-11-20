/**
 * Copyright 2012, Digital Fusion
 * Licensed under the MIT license.
 * http://teamdf.com/jquery-plugins/license/
 *
 * @author Sam Sehnert
 * @desc A small plugin that checks whether elements are within
 *                 the user visible viewport of a web browser.
 *                 only accounts for vertical position, not horizontal.
 */
$.fn.onScreen = function(){
    var $t                   = $(this).eq(0),
        t                    = $t.get(0),
        $w                   = $(window),
        viewTop              = $w.scrollTop(),
        viewBottom           = viewTop + $w.height(),
        _top                 = $t.offset().top,
        _bottom              = _top + $t.height(),
        compareTop           = _bottom,
        compareBottom        = _top;

        return ((compareBottom <= viewBottom) && (compareTop >= viewTop));
};

Discourse.PostHolderView = Discourse.ContainerView.extend(Discourse.Scrolling, {
  classNames: ['post-holder'],
  attributeBindings: ['style'],

  init: function() {
    this._super();
    this.showPost();
    console.log('created postholderview');
  },

  showPost: function() {
    if (this.get('length') === 0) {
      this.attachViewWithArgs({ content: this.get('content') }, Discourse.PostView);
    }
  },

  hidePost: function() {
    var currentHeight = this.$().height();
    this.set('style', 'height: ' + currentHeight + 'px;');

    Ember.run.scheduleOnce('afterRender', this, 'clear');
  },

  scrolled: function() {
    if (!this.$().onScreen()) {
      this.hidePost();
    } else {
      this.showPost();
    }
  },

  didInsertElement: function() {
    this.bindScrolling();
  },

  willDestroyElement: function() {
    this.unbindScrolling();
  }

});
