Discourse.DummyPostView = Discourse.View.extend({
  classNames: ['topic-post', 'clearfix', 'ready'],
  templateName: 'post',
  classNameBindings: ['postTypeClass',
                      'selected',
                      'post.hidden:hidden',
                      'post.deleted'],

  postBinding: 'content',

  render: function(buffer) {
    buffer.push("<div class='placeholder' style='height: 200px; background-color: #f00;'>Placeholder " + this.get('post.post_number') + "</div>")
  }

})