// placed into the public domain by tav@espians.com

var CURRENT_USER = '',
    CURRENT_CONTEXT = '',
    CURRENT_QUERY = '',
    INCLUDE_USER = false,
    INCLUDE_CONTEXT = false,
    AUTOTRANSLATE_LANGUAGE = null;
    LOADING = false,
    DEBUG = false;

var link_regexp = /((ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/gi,
    user_regexp = /[\@]+([A-Za-z0-9-_]+)/gi,
    hash_regexp = /[\#]+([^ /\)]+)/gi;

$(function () {

// konstants and variables

var API_BASE_URL = 'http://www.trustmap.org/api/v1/',
    TWITTER_SEARCH_URL = 'http://search.twitter.com/search.json?rpp=100&lang=all&q=',
    DEFAULT_IMAGE_URL = "http://www.trustmap.org/static/img/default_profile_normal.png";

var loc = window.location,
    timeout_id = null,
    last_fragment = '',
    recent_node = $('#recent'),
    recent_list_node = $('#recent-list'),
    listing_node = $('#listing'),
    tagcloud_node = $('#tagcloud'),
    results_node = $('#results'),
    home_node = $('#home'),
    q_node = $('#q'),
    current_trustmap_node = $('#current-trustmap'),
    current_trustmap_user_node = $('#current-trustmap-user'),
    current_trustmap_context_node = $('#current-trustmap-context'),
    current_trustmap_listing_node = $('#current-trustmap-listing'),
    current_user_refresh_node = $('#current-user-refresh'),
    current_context_refresh_node = $('#current-context-refresh'),
    current_context_node = $('#current-context'),
    trustmap_user_node = $('#trustmap-user'),
    infolist_node = $('#infolist'),
    infolist_container_node = $('#infolist-container'),
    info_node = $('#info'),
    qform_node = $('#qform'),
    error_messages_node = $('#error-messages'),
    errorlist_node = $('#errorlist'),
    view_user_node = $('#view-user');

var trustmaps = {},
    tweets = {},
    recent_searches = {},
    profile_images = {},
    profile_names = {};

// utility funktions

function unescape_xml (xml) {
  // return xml.replace('&quot;', '"').replace('&gt;', '>').replace('&lt;', '<').replace('&amp;', '&');
  var node = document.createElement("div");
  node.innerHTML = xml;
  if (node.innerText !== undefined)
    return node.innerText;
  return node.textContent;
};

function get_fragment () {
  return loc.href.replace(/^[^#]*#?/, '');
};

function set_fragment (fragment, last) {
  loc.href = loc.href.replace(/#.*$/, '') + '#' + fragment;
  if (browser.msie && browser.version < 8) {
    if ($.isFunction(ie_history))
      ie_history = ie_history();
	ie_history['update'](fragment);
    if (last)
      last_fragment = ie_history['fragment']();
  } else {
    if (last)
      last_fragment = loc.href.replace(/^[^#]*#?/, '');
  }
};

function load_fragment (fragment) {
  fragment = fragment.split('/');

  var include = false;
  if (fragment[0] == '.include'){
    include = true;
    fragment.shift(0);
  }

  if (!fragment)
    return false;

  if (fragment.length == 1) {
    CURRENT_USER = decodeURIComponent(fragment[0]);
    CURRENT_CONTEXT = '';
    CURRENT_QUERY = '';
  } else if (fragment.length == 2) {
    CURRENT_USER = decodeURIComponent(fragment[0]);
    CURRENT_CONTEXT = decodeURIComponent(fragment[1]);
    CURRENT_QUERY = '';
  } else if (fragment.length == 3) {
    CURRENT_USER = decodeURIComponent(fragment[0]);
    CURRENT_CONTEXT = decodeURIComponent(fragment[1]);
    CURRENT_QUERY = decodeURIComponent(fragment[2]);
  }

  if (CURRENT_CONTEXT) {
    load_context(CURRENT_USER, CURRENT_CONTEXT, CURRENT_QUERY, include);
  } else {
    load_user(CURRENT_USER);
  }

  return false;

};

function load_context_handler (context, event) {
  if (INCLUDE_CONTEXT) {
    load_context(CURRENT_USER, context, context, INCLUDE_USER, true);
  } else {
    load_context(CURRENT_USER, context, null, INCLUDE_USER, true);
  }
};

function generate_load_context_onclick_handler (user, context, query) {
  return function () {
    load_context(user, context, query);
    return false;
  };
};

var error_stack_count = 0;
var message_stack_count = 0;

function hide_error_message (msg) {
  msg.remove();
  error_stack_count -= 1;
  if (!error_stack_count)
	error_messages_node.hide();
};

function display_message (message) {
  infolist_container_node.show();
  var msg = $('<li>' + message + '</li>').addClass('loading');
  infolist_node.append(msg);
  message_stack_count += 1;
  $('.loaded').remove();
  $('.error').remove();
  return msg;
};

function update_message (msg, text, error) {
  if (error === true) {
    var add_class = 'error';
	var errmsg = $('<div class="errmsg">' + text + '</div>');
	errorlist_node.append(errmsg);
	error_messages_node.show();
	errmsg.animate({'backgroundColor': '#ffff9c'}, 500);
    error_stack_count += 1;
	setTimeout(function () { hide_error_message(errmsg); }, 2100);
  } else {
    var add_class = 'loaded';
  }
  if (DEBUG) {
    msg.removeClass('loading').addClass(add_class).text(text);
  } else {
	msg.remove();
    message_stack_count -= 1;
    if (!message_stack_count)
      infolist_container_node.hide();
  }
};

function get_tweets (path, trustmap_title, _user, context, query, include) {
  q_node.focus();
  var users = trustmaps[trustmap_title]['users'];
  current_trustmap_listing_node.empty();
  current_trustmap_user_node.text('@' + _user);
  current_trustmap_user_node.unbind('click').click(function () { return load_user(_user); });
  current_trustmap_context_node.text(context);
  current_trustmap_context_node.unbind('click').click(function () { return load_context(_user, context, query, include); });
  for (var m=0; m < users.length; m++) {
	var user = users[m];
	if (user == _user)
	  continue;
	var profile_name = profile_names[user];
	if (profile_name) {
	  if (profile_name == user)
		profile_name = '';
	} else {
	  profile_name = '';
	}
    if (include) {
      var include_close = '\', null, true);">';
      var include_query_close = '\', true);">';
    } else {
      var include_close = '\');">';
      var include_query_close = '\');">';
    }
    if (query) {
      var query_extra = ' / <a href="" onclick="return load_context(\'' + user.replace('\'', '\\\'') + '\', \'' + context.replace('\'', '\\\'') + '\', \'' + query.replace('\'', '\\\'') + include_query_close + query + '</a>';
    } else {
      var query_extra = '';
    }
    current_trustmap_listing_node.append('<li><a target="_blank" href="http://twitter.com/' + user.replace('\'', '\\\'') + '"><img src="' + (profile_images[user] || DEFAULT_IMAGE_URL) + '" width="48px" height="48px" /></a> <a href="" class="link" onclick="return load_user(\'' + user.replace('\'', '\\\'') + '\');">@' + user.replace('\'', '\\\'') + '</a> / <a href="" onclick="return load_context(\'' + user + '\', \'' + context.replace('\'', '\\\'') + include_close + context.replace('\'', '\\\'') + '</a>' + query_extra + '<br />' + profile_name + '<hr class="clear" /></li>');
  }
  current_trustmap_node.show();
  var q = '';
  if (query && query.length) {
    q = encodeURIComponent(query + ' ');
    trustmap_title = trustmap_title + ' / ' + query;
  }
  if (q.length > 100)
    alert("The search terms are too long! (> 100 chars)");
  var queries = [];
  var extra = '';
  var newbit = '';
  var potential = '';
  if (include) {
    var xusers = users.slice(0);
	xusers.unshift(_user);
  } else {
    var xusers = users;
  }
  for (var i=0; i < xusers.length; i++) {
    newbit = encodeURIComponent('from:' + xusers[i]);
    potential = '';
    if (extra.length)
      potential = '+OR+';
    potential += newbit;
    if ((q + extra + potential).length > 140) {
      queries.push(q + extra);
      extra = '';
    } else {
      extra += potential;
    }
  }
  if (extra.length)
    queries.push(q + extra);
  if (tweets[path]) {
    if (tweets[path].since_id) {
      var since_id = tweets[path].since_id;
    } else {
      var since_id = null;
    }
  } else {
    tweets[path] = {'tweets': {}};
    var since_id = null;
  }
  var tweetdata = tweets[path];
  var now = new Date();
  for (var j=0; j < queries.length; j++) {
    do_twitter_search(j, queries[j], path, trustmap_title, _user, context, query, include, since_id, tweetdata, now);
  }
  return false;
};

function do_twitter_search (i, qstring, path, trustmap_title, user, context, query, include, since_id, tweetdata, now) {
  if (i == 0) {
	if (DEBUG) {
      var msg = display_message("Getting tweets for " + trustmap_title);
	} else {
      var msg = display_message("Getting tweets");
	}
  } else {
	if (DEBUG) {
      var msg = display_message("Getting more tweets for " + trustmap_title + " [" + (i + 1) + "]");
	} else {
      var msg = display_message("Getting more tweets");
	}
  }
  $.getJSON(TWITTER_SEARCH_URL + qstring + (since_id ? '&since_id=' + since_id : '') + '&callback=?', function (data) {
    if (!data.results) {
      update_message(msg, "No " + (since_id ? "new " : "") + "results found for " + trustmap_title);
      render_tweets(user, context, query, tweetdata);
    }
    if (!data.results.length) {
      update_message(msg, "No " + (since_id ? "new " : "") + "results found for " + trustmap_title);
      render_tweets(user, context, query, tweetdata);
    }
    var messages = [];
    var results = data.results;
    var result;
    var tweetdict = tweetdata.tweets;
    for (var j=0; j < results.length; j++) {
      result = results[j];
      var tweet_id = result.id;
      if (tweet_id > since_id)
        since_id = tweet_id;
      var tweeter = result.from_user;
      var tweet_lang = (result.to_user && (result.to_user.toLowerCase() == 'trustmap')) ? 'en' : (result.iso_language_code || '');
      tweetdict[tweet_id] = $('<div class="tweet" id="tweet-' + tweet_id + '"><a class="profile-image" href="http://twitter.com/' + tweeter + '" target="_blank"><img width="48px" height="48px" src="' + result.profile_image_url + '" alt="' + tweeter + '\'s profile image" /></a><div class="tweet-content"><div class="tweet-author"><a href="http://twitter.com/' + tweeter + '" target="_blank">' + tweeter + '</a>: </div><div class="tweet-message untranslated" lang="' + tweet_lang + '">' + link_tweet(result.text) + '</div><div class="tweet-extra"><span timestamp="' + result.created_at + '">' + get_relative_datetime(result.created_at, now) + '</span> via ' + unescape_xml(result.source) + ' &middot; <a target="_blank" href="http://twitter.com/?status=' + encodeURIComponent('@' + tweeter + ' ') + '&in_reply_to_status=' + tweet_id + '&in_reply_to=' + tweeter + '">Reply</a> &middot; <a target="_blank" href="http://twitter.com/' + tweeter + '/statuses/' + tweet_id + '">View Tweet</a></div></div></div>');
    }
    render_tweets(user, context, query, tweetdata);
    update_message(msg, "Updated tweets for " + trustmap_title + ((i == 0) ? "" : " [" + (i + 1) + "]"));
  });
};

function render_tweets (user, context, query, tweetdata) {
  if ((context != CURRENT_CONTEXT) || (query != CURRENT_QUERY))
    return;
  var keys = [];
  var tweetdict = tweetdata.tweets;
  for (var k in tweetdict)
    keys.push(k);
  keys.sort().reverse();
  listing_node.empty();
  var tweet;
  if (!keys.length) {
    if (!$('.tweet').length)
      listing_node.append('<div class="center">No Results Found</div>');
    return;
  }
  if (query) {
    listing_node.append('<div class="search-title">Tweets mentioning \'' + query + '\' from people @' + user + ' trusts for <em>' + context + '</em></div>');
  } else {
    listing_node.append('<div class="search-title">Tweets from people @' + user + ' trusts for <em>' + context + '</em></div>');
  }
  for (var i=0; i < keys.length; i++)
    listing_node.append(tweetdict[keys[i]]);
  if (keys.length) {
    tweetdata['since_id'] = keys[0];
  }
  translate_tweets();
};

function change_view_user () {
  var view_user = view_user_node.val().toLowerCase().replace('@', '');
  if (view_user.length) {
    $.cookie("user", view_user, { expires: 300 });
    load_user(view_user);
  }
  return false;
};

function set_user (user) {
  view_user_node.val(user);
  CURRENT_USER = user;
  trustmap_user_node.text('@' + user).attr('user', user).unbind('click').click(function () {return load_user(user); });
};

function update_view_context (path, trustmap_title, user, context, query, include) {
  CURRENT_CONTEXT = context;
  CURRENT_QUERY = query;
  qform_node.unbind('submit').bind('submit', function () {
    return load_context(user, context, q_node.val(), include);
  });
  current_user_refresh_node.text(user.toUpperCase()).unbind('click').click(function () {return load_user(user); });
  current_context_refresh_node.unbind('click').click(function () {return load_context(user, context, query, include); });
  current_context_node.text(context.toUpperCase()).unbind('click').click(function () {return load_context(user, context, query, include); });
  if (query) {
    q_node.val(query);
  } else {
    q_node.val('');
  }
  set_fragment(path, true);
  listing_node.empty();
  results_node.show('slow');
  get_tweets(path, trustmap_title, user, context, query, include);
};

function exit_load_context_with_message (msg, text, user, homeclick) {
  update_message(msg, text, true);
  if (homeclick)
    setTimeout(function () { load_user(user); }, 1800);
  return;
};

function get_fragment_path (user, context, query, include) {
  var path = '';
  if (include)
    path = encodeURIComponent('.include') + '/';
  path += encodeURIComponent(user) + '/' + encodeURIComponent(context);
  if (query)
    path += '/' + encodeURIComponent(query);
  return path;
};

function load_context (user, context, query, include, homeclick) {

  var path = get_fragment_path(user, context, query, include);
  home_node.hide();
  set_user(user);

  var trustmap_title = '@' + user + ' / ' + context;
  var search_title = trustmap_title;

  if (query)
    search_title += ' / ' + query;

  recent_searches[search_title] = [(new Date()).getTime(), user, context, (query || null)];

  var recent_list = [];
  for (var k in recent_searches)
    recent_list.push(recent_searches[k]);

  render_recents(recent_list);

  try {
    $.cookie('recent', $.toJSON(recent_list), { expires: 300 });
  } catch (err) {
  }

  if (trustmaps[trustmap_title] && (trustmaps[trustmap_title]['updated'] - (new Date).getTime()) < 6000) {
    set_user(user);
    update_view_context(path, trustmap_title, user, context, query, include);
    return false;
  }

  var msg = display_message("Getting the Trustmap for " + trustmap_title);

  $.getJSON(API_BASE_URL + "get_trusted_users?limit=99&format=json&callback=?&user=" + encodeURIComponent('@' + user) + '&context=' + encodeURIComponent(context), function (data) {

    if ((data.status) && (data.status != 200)) {
      if (data.message)
        return exit_load_context_with_message(msg, data.message, user, homeclick);
      return exit_load_context_with_message(msg, "No data found for " + trustmap_title, user, homeclick);
    }
    if ((!data.results) || (!data.results.length))
      return exit_load_context_with_message(msg, "No data found for " + trustmap_title, user, homeclick);

    update_message(msg, "Got trustmap for " + trustmap_title);

    var users = [];

    var results = data.results;
    var result;

    for (var i=0; i < results.length; i++) {
      result = results[i];
      if (result && result['twitter_screen_name']) {
		var twitter_id = result['twitter_screen_name'];
        users.push(twitter_id);
		try {
          profile_images[twitter_id] = result.thumbnail_image.image_src;
		} catch (err) {
          profile_images[twitter_id] = DEFAULT_IMAGE_URL;
		}
		try {
          profile_names[twitter_id] = result.display_name;
		} catch (err) {
          profile_names[twitter_id] = null;
		}
	  }
    }

    if (!users.length)
      return exit_load_context_with_message(msg, "No data found for " + trustmap_title, user, homeclick);
    trustmaps[trustmap_title] = {
      'updated': ((new Date).getTime()),
      'users': users
      };
    set_user(user);
    update_view_context(path, trustmap_title, user, context, query, include);
    return false;

  });

  return false;

};

function load_user (user) {

  var msg = display_message("Getting the list of @" + user + "'s trustmaps");

  view_user_node.focus();

  $.getJSON(API_BASE_URL + "get_contexts_for_user?limit=99&format=json&callback=?&user=" + encodeURIComponent('@' + user), function (data) {

    if ((data.status) && (data.status != 200)) {
      if (data.message) {
        update_message(msg, data.message, true);
      } else {
        update_message(msg, "No trustmaps found for @" + user, true);
      }
      return;
    }

    if (!data.results) {
      update_message(msg, "No trustmaps found for @" + user, true);
      return;
    }

    if (!data.results.length) {
      update_message(msg, "No trustmaps found for @" + user, true);
      return;
    }

    set_user(user);
    update_message(msg, "Got data for @" + user);

    var contexts = [];
    var results = data.results;
    for (var i=0; i < results.length; i++) {
      contexts.push({'tag': results[i], 'count': 1});
    }

    tagcloud_node.tagCloud(contexts, {'click': load_context_handler});
    listing_node.empty();
    results_node.hide();
    current_trustmap_node.hide();
    home_node.show();
    $('#current-user').text('@' + user).attr('href', 'http://www.trustmap.org/%40' + user).attr('target', '_blank');
    set_fragment(encodeURIComponent(user), true);

    return;

  });

  return false;

};

function render_recents (recent_list) {

  var search_title,
      recent_item,
      recent_click,
      user,
      context,
      query,
      max = Math.min(5, recent_list.length);

  recent_list_node.empty();
  recent_list.sort().reverse();

  for (var k=0; k < max; k++) {
    user = recent_list[k][1];
    context = recent_list[k][2];
    query = recent_list[k][3];
    search_title = '@' + user + ' / ' + context;
    if (query)
      search_title += ' / ' + query;
    recent_item = $('<li></li>');
    recent_click = $('<a href="">' + search_title + '</a>').click(
	  generate_load_context_onclick_handler(user, context, query)
	);
    recent_item.append(recent_click);
    recent_list_node.append(recent_item);
  }

  recent_node.show();

};

function clear_recents () {
  recent_searches = {};
  recent_node.hide();
  recent_list_node.empty();
  $.cookie('recent', $.toJSON([]), { expires: 300 });
  return false;
};

function oembed_tweets (date) {
};

/*
 * The following was adapted from
 * http://37signals.com/svn/posts/1557-javascript-makes-relative-times-compatible-with-caching
 *
 */

var str_less_than_a_minute_ago = 'less than a minute ago',
    str_about_a_minute_ago = 'about a minute ago',
    str_minutes_ago = ' minutes ago',
    str_about_an_hour_ago = 'about an hour ago',
    str_about = 'about ',
    str_hours_ago = ' hours ago',
    str_1_day_ago = '1 day ago',
    str_days_ago = ' days ago';

function get_relative_datetime (datetime) {

  var parsed_date = Date.parse(datetime);
  var relative_to = (arguments.length > 1) ? arguments[1] : new Date();
  var delta = parseInt((relative_to.getTime() - parsed_date) / 1000);

  if (delta < 60) {
    return str_less_than_a_minute_ago;
  } else if (delta < 120) {
    return str_about_a_minute_ago;
  } else if (delta < (2700)) { // 45 * 60
    return (parseInt(delta / 60)).toString() + str_minutes_ago;
  } else if (delta < (5400)) { // 90 * 60
    return str_about_an_hour_ago;
  } else if (delta < (86400)) { // 24 * 60 * 60
    return str_about + (parseInt(delta / 3600)).toString() + str_hours_ago;
  } else if (delta < (172800)) { // 48 * 60 * 60
    return str_1_day_ago;
  } else {
    return (parseInt(delta / 86400)).toString() + str_days_ago;
  }

};

/*
 * The following was adapted from URL Utils - v1.11 - 9/10/2009
 * http://benalman.com/
 *
 * Copyright (c) 2009 "Cowboy" Ben Alman
 * Licensed under the MIT license
 * http://benalman.com/about/license/
 *
 */

var str_onfragmentchange = 'onfragmentchange',
	str_fragment = 'fragment',
	str_hashchange_onfragmentchange = 'hashchange' + str_onfragmentchange,
    str_update = 'update',
    has_onhashchange = 'onhashchange' in window;

$['onfragmentchange'] = function (delay) {

  if (delay === true)
    delay = 100;

  function trigger () {
    var event = $.Event(str_onfragmentchange);
    event[str_fragment] = get_fragment();
    $(document).trigger(event);
  };

  if (has_onhashchange)
    $(window).unbind(str_hashchange_onfragmentchange);

  timeout_id && clearTimeout(timeout_id);
  timeout_id = null;

  if (typeof delay !== 'number')
    return;

  if (has_onhashchange) {
    $(window).bind(str_hashchange_onfragmentchange, trigger);
    return;
  }

  // last_fragment = get_fragment();

  if ($.isFunction(ie_history))
    ie_history = ie_history();

  (function check_fragment_loop () {

    var frag = get_fragment(),
        ie_frag = ie_history[str_fragment](last_fragment);
    if (frag !== last_fragment) {
      ie_history[str_fragment](frag, ie_frag);
      last_fragment = frag;
      trigger();
    } else if (ie_frag !== last_fragment) {
	  if (ie_frag) {
        set_fragment(ie_frag);
      }
    }

    timeout_id = setTimeout(check_fragment_loop, delay < 0 ? 0 : delay );

   })();

};

var ie_history_iframe,
    browser = $.browser;

function ie_history () {

  var that = {};

  that[str_update] = that[str_fragment] = function (val) { return val; };

  if (browser.msie && browser.version < 8) {

    that[str_update] = function (frag, ie_frag) {
      var doc = ie_history_iframe.document;
      if (frag !== ie_frag) {
        doc.open();
        doc.close();
        doc.location.hash = '#' + frag;
      }
    };

    that[str_fragment] = function () {
      return ie_history_iframe.document.location.hash.replace(/^#/, '');
    };

    ie_history_iframe = $('<iframe/>').hide().appendTo('body').get(0).contentWindow;

    that[str_update](get_fragment());

  }

  return that;

};

function first_load () {

  var include_context = $.cookie("include_context");
  if (include_context == 'true') {
    INCLUDE_CONTEXT = true;
    $('#default-context-option').attr('checked', true);
  } else {
    INCLUDE_CONTEXT = false;
  }

  var include_user = $.cookie("include_user");
  if (include_user == 'true') {
    INCLUDE_USER = true;
    $('#default-user-option').attr('checked', true);
  } else {
    INCLUDE_USER = false;
  }

  AUTOTRANSLATE_LANGUAGE = $.cookie('lang');
  if (AUTOTRANSLATE_LANGUAGE)
	$('#open' + AUTOTRANSLATE_LANGUAGE).attr('selected', '1');

  last_fragment = get_fragment();

  if (!last_fragment)
    last_fragment = $.cookie("user");

  if (!last_fragment)
    last_fragment = 'tav/python/python'; // default

  load_fragment(last_fragment);

  var recents = $.cookie('recent');
  var search_title;

  if (recents) {
    try {
      recents = eval('('+recents+')');
	  for (var i=0; i<recents.length; i++) {
        search_title = '@' + recents[i][1] + ' / ' + recents[i][2];
        if (recents[i][3])
          search_title += ' / ' + recents[i][3];
        recent_searches[search_title] = recents[i];
      }
    } catch (err) {
      return;
    }
    render_recents(recents);
  }

  $.onfragmentchange(true);

  $(document).bind(
    'onfragmentchange',
    function (e) {
      load_fragment(e['fragment']);
    }
  );

};

first_load();

window.load_context = load_context;
window.load_user = load_user;
window.change_view_user = change_view_user;
window.clear_recents = clear_recents;

});

function toggle_default_context_option () {
  if (INCLUDE_CONTEXT) {
    INCLUDE_CONTEXT = false;
  } else {
    INCLUDE_CONTEXT = true;
  }
  $.cookie("include_context", $.toJSON(INCLUDE_CONTEXT), { expires: 300 });
 return false;
};

function toggle_default_user_option () {
  if (INCLUDE_USER) {
    INCLUDE_USER = false;
  } else {
    INCLUDE_USER = true;
  }
  $.cookie("include_user", $.toJSON(INCLUDE_USER), { expires: 300 });
 return false;
};

function set_language(choice) {
  AUTOTRANSLATE_LANGUAGE = choice.value;
  $.cookie("lang", AUTOTRANSLATE_LANGUAGE, { expires: 300 });
  if (AUTOTRANSLATE_LANGUAGE)
    just_translate_tweets();
};

AUTOTRANSLATE_MESSAGE = '<div class="autotranslate-note">Autotranslated using Google Translate</div>';

function link_tweet(tweet) {
  return tweet.replace(link_regexp, '<a href="$1" class="external" target="_blank">$1</a>').replace(user_regexp, '<a href="http://twitter.com/$1" target="_blank">@$1</a>').replace(hash_regexp, ' <a href="http://search.twitter.com/search?q=&lang=all&tag=$1" target="_blank">#$1</a>');
};

function generate_translation_callback (ref, ori_content, lang) {
  return function (result) {
    var content;
	if (!result.error) {
      content = result.translation;
	} else {
      content = ori_content;
	}
    ref.html(content).attr('lang', lang).append($(AUTOTRANSLATE_MESSAGE)).longurlplease();
  };
};

function just_translate_tweets () {
  var lang, ref;
  $('.tweet-message').removeClass('untranslated').each(function (idx, elem) {
    ref = $(elem);
    lang = ref.attr('lang');
    if (lang != AUTOTRANSLATE_LANGUAGE) {
      google.language.translate(elem.innerHTML, "", AUTOTRANSLATE_LANGUAGE, generate_translation_callback(ref, elem.innerHTML, AUTOTRANSLATE_LANGUAGE));
    };
  });
};

function translate_tweets () {
  if (!AUTOTRANSLATE_LANGUAGE) {
	$('.untranslated').longurlplease();
    return;
  }
  var lang, ref;
  $('.untranslated').removeClass('untranslated').each(function (idx, elem) {
    ref = $(elem);
    lang = ref.attr('lang');
    if (lang != AUTOTRANSLATE_LANGUAGE) {
      google.language.translate(elem.innerHTML, "", AUTOTRANSLATE_LANGUAGE, generate_translation_callback(ref, elem.innerHTML, AUTOTRANSLATE_LANGUAGE));
    } else { ref.longurlplease(); };
  });
};
