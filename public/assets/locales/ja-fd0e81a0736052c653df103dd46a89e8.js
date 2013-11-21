// https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Array/indexOf
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(searchElement /*, fromIndex */) {
    "use strict";

    if (this === void 0 || this === null) {
      throw new TypeError();
    }

    var t = Object(this);
    var len = t.length >>> 0;

    if (len === 0) {
      return -1;
    }

    var n = 0;
    if (arguments.length > 0) {
      n = Number(arguments[1]);
      if (n !== n) { // shortcut for verifying if it's NaN
        n = 0;
      } else if (n !== 0 && n !== (Infinity) && n !== -(Infinity)) {
        n = (n > 0 || -1) * Math.floor(Math.abs(n));
      }
    }

    if (n >= len) {
      return -1;
    }

    var k = n >= 0
          ? n
          : Math.max(len - Math.abs(n), 0);

    for (; k < len; k++) {
      if (k in t && t[k] === searchElement) {
        return k;
      }
    }

    return -1;
  };
}

// Instantiate the object
var I18n = I18n || {};

// Set default locale to english
I18n.defaultLocale = "en";

// Set default handling of translation fallbacks to false
I18n.fallbacks = false;

// Set default separator
I18n.defaultSeparator = ".";

// Set current locale to null
I18n.locale = null;

// Set the placeholder format. Accepts `{{placeholder}}` and `%{placeholder}`.
I18n.PLACEHOLDER = /(?:\{\{|%\{)(.*?)(?:\}\}?)/gm;

I18n.fallbackRules = {};

I18n.pluralizationRules = {
  en: function (n) {
    return n == 0 ? ["zero", "none", "other"] : n == 1 ? "one" : "other";
  }
};

I18n.getFallbacks = function(locale) {
  if (locale === I18n.defaultLocale) {
    return [];
  } else if (!I18n.fallbackRules[locale]) {
    var rules = []
      , components = locale.split("-");

    for (var l = 1; l < components.length; l++) {
      rules.push(components.slice(0, l).join("-"));
    }

    rules.push(I18n.defaultLocale);

    I18n.fallbackRules[locale] = rules;
  }

  return I18n.fallbackRules[locale];
}

I18n.isValidNode = function(obj, node, undefined) {
  return obj[node] !== null && obj[node] !== undefined;
};

I18n.lookup = function(scope, options) {
  var options = options || {}
    , lookupInitialScope = scope
    , translations = this.prepareOptions(I18n.translations)
    , locale = options.locale || I18n.currentLocale()
    , messages = translations[locale] || {}
    , options = this.prepareOptions(options)
    , currentScope
  ;

  if (typeof(scope) == "object") {
    scope = scope.join(this.defaultSeparator);
  }

  if (options.scope) {
    scope = options.scope.toString() + this.defaultSeparator + scope;
  }

  scope = scope.split(this.defaultSeparator);

  while (messages && scope.length > 0) {
    currentScope = scope.shift();
    messages = messages[currentScope];
  }

  if (!messages) {
    if (I18n.fallbacks) {
      var fallbacks = this.getFallbacks(locale);
      for (var fallback = 0; fallback < fallbacks.length; fallbacks++) {
        messages = I18n.lookup(lookupInitialScope, this.prepareOptions({locale: fallbacks[fallback]}, options));
        if (messages) {
          break;
        }
      }
    }

    if (!messages && this.isValidNode(options, "defaultValue")) {
        messages = options.defaultValue;
    }
  }

  return messages;
};

// Merge serveral hash options, checking if value is set before
// overwriting any value. The precedence is from left to right.
//
//   I18n.prepareOptions({name: "John Doe"}, {name: "Mary Doe", role: "user"});
//   #=> {name: "John Doe", role: "user"}
//
I18n.prepareOptions = function() {
  var options = {}
    , opts
    , count = arguments.length
  ;

  for (var i = 0; i < count; i++) {
    opts = arguments[i];

    if (!opts) {
      continue;
    }

    for (var key in opts) {
      if (!this.isValidNode(options, key)) {
        options[key] = opts[key];
      }
    }
  }

  return options;
};

I18n.interpolate = function(message, options) {
  options = this.prepareOptions(options);
  var matches = message.match(this.PLACEHOLDER)
    , placeholder
    , value
    , name
  ;

  if (!matches) {
    return message;
  }

  for (var i = 0; placeholder = matches[i]; i++) {
    name = placeholder.replace(this.PLACEHOLDER, "$1");

    value = options[name];

    if (!this.isValidNode(options, name)) {
      value = "[missing " + placeholder + " value]";
    }

    var regex = new RegExp(placeholder.replace(/\{/gm, "\\{").replace(/\}/gm, "\\}"));
    message = message.replace(regex, value);
  }

  return message;
};

I18n.translate = function(scope, options) {
  options = this.prepareOptions(options);
  var translation = this.lookup(scope, options);

  try {
    if (typeof(translation) == "object") {
      if (typeof(options.count) == "number") {
        return this.pluralize(options.count, scope, options);
      } else {
        return translation;
      }
    } else {
      return this.interpolate(translation, options);
    }
  } catch (error) {
    return this.missingTranslation(scope);
  }
};

I18n.localize = function(scope, value) {
  switch (scope) {
    case "currency":
      return this.toCurrency(value);
    case "number":
      scope = this.lookup("number.format");
      return this.toNumber(value, scope);
    case "percentage":
      return this.toPercentage(value);
    default:
      if (scope.match(/^(date|time)/)) {
        return this.toTime(scope, value);
      } else {
        return value.toString();
      }
  }
};

I18n.parseDate = function(date) {
  var matches, convertedDate;

  // we have a date, so just return it.
  if (typeof(date) == "object") {
    return date;
  };

  // it matches the following formats:
  //   yyyy-mm-dd
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ss
  //   yyyy-mm-dd[ T]hh:mm::ssZ
  //   yyyy-mm-dd[ T]hh:mm::ss+0000
  //
  matches = date.toString().match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?(Z|\+0000)?/);

  if (matches) {
    for (var i = 1; i <= 6; i++) {
      matches[i] = parseInt(matches[i], 10) || 0;
    }

    // month starts on 0
    matches[2] -= 1;

    if (matches[7]) {
      convertedDate = new Date(Date.UTC(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]));
    } else {
      convertedDate = new Date(matches[1], matches[2], matches[3], matches[4], matches[5], matches[6]);
    }
  } else if (typeof(date) == "number") {
    // UNIX timestamp
    convertedDate = new Date();
    convertedDate.setTime(date);
  } else if (date.match(/\d+ \d+:\d+:\d+ [+-]\d+ \d+/)) {
    // a valid javascript format with timezone info
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date))
  } else {
    // an arbitrary javascript string
    convertedDate = new Date();
    convertedDate.setTime(Date.parse(date));
  }

  return convertedDate;
};

I18n.toTime = function(scope, d) {
  var date = this.parseDate(d)
    , format = this.lookup(scope)
  ;

  if (date.toString().match(/invalid/i)) {
    return date.toString();
  }

  if (!format) {
    return date.toString();
  }

  return this.strftime(date, format);
};

I18n.strftime = function(date, format) {
  var options = this.lookup("date");

  if (!options) {
    return date.toString();
  }

  options.meridian = options.meridian || ["AM", "PM"];

  var weekDay = date.getDay()
    , day = date.getDate()
    , year = date.getFullYear()
    , month = date.getMonth() + 1
    , hour = date.getHours()
    , hour12 = hour
    , meridian = hour > 11 ? 1 : 0
    , secs = date.getSeconds()
    , mins = date.getMinutes()
    , offset = date.getTimezoneOffset()
    , absOffsetHours = Math.floor(Math.abs(offset / 60))
    , absOffsetMinutes = Math.abs(offset) - (absOffsetHours * 60)
    , timezoneoffset = (offset > 0 ? "-" : "+") + (absOffsetHours.toString().length < 2 ? "0" + absOffsetHours : absOffsetHours) + (absOffsetMinutes.toString().length < 2 ? "0" + absOffsetMinutes : absOffsetMinutes)
  ;

  if (hour12 > 12) {
    hour12 = hour12 - 12;
  } else if (hour12 === 0) {
    hour12 = 12;
  }

  var padding = function(n) {
    var s = "0" + n.toString();
    return s.substr(s.length - 2);
  };

  var f = format;
  f = f.replace("%a", options.abbr_day_names[weekDay]);
  f = f.replace("%A", options.day_names[weekDay]);
  f = f.replace("%b", options.abbr_month_names[month]);
  f = f.replace("%B", options.month_names[month]);
  f = f.replace("%d", padding(day));
  f = f.replace("%e", day);
  f = f.replace("%-d", day);
  f = f.replace("%H", padding(hour));
  f = f.replace("%-H", hour);
  f = f.replace("%I", padding(hour12));
  f = f.replace("%-I", hour12);
  f = f.replace("%m", padding(month));
  f = f.replace("%-m", month);
  f = f.replace("%M", padding(mins));
  f = f.replace("%-M", mins);
  f = f.replace("%p", options.meridian[meridian]);
  f = f.replace("%S", padding(secs));
  f = f.replace("%-S", secs);
  f = f.replace("%w", weekDay);
  f = f.replace("%y", padding(year));
  f = f.replace("%-y", padding(year).replace(/^0+/, ""));
  f = f.replace("%Y", year);
  f = f.replace("%z", timezoneoffset);

  return f;
};

I18n.toNumber = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ",", strip_insignificant_zeros: false}
  );

  var negative = number < 0
    , string = Math.abs(number).toFixed(options.precision).toString()
    , parts = string.split(".")
    , precision
    , buffer = []
    , formattedNumber
  ;

  number = parts[0];
  precision = parts[1];

  while (number.length > 0) {
    buffer.unshift(number.substr(Math.max(0, number.length - 3), 3));
    number = number.substr(0, number.length -3);
  }

  formattedNumber = buffer.join(options.delimiter);

  if (options.precision > 0) {
    formattedNumber += options.separator + parts[1];
  }

  if (negative) {
    formattedNumber = "-" + formattedNumber;
  }

  if (options.strip_insignificant_zeros) {
    var regex = {
        separator: new RegExp(options.separator.replace(/\./, "\\.") + "$")
      , zeros: /0+$/
    };

    formattedNumber = formattedNumber
      .replace(regex.zeros, "")
      .replace(regex.separator, "")
    ;
  }

  return formattedNumber;
};

I18n.toCurrency = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.currency.format"),
    this.lookup("number.format"),
    {unit: "$", precision: 2, format: "%u%n", delimiter: ",", separator: "."}
  );

  number = this.toNumber(number, options);
  number = options.format
    .replace("%u", options.unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toHumanSize = function(number, options) {
  var kb = 1024
    , size = number
    , iterations = 0
    , unit
    , precision
  ;

  while (size >= kb && iterations < 4) {
    size = size / kb;
    iterations += 1;
  }

  if (iterations === 0) {
    unit = this.t("number.human.storage_units.units.byte", {count: size});
    precision = 0;
  } else {
    unit = this.t("number.human.storage_units.units." + [null, "kb", "mb", "gb", "tb"][iterations]);
    precision = (size - Math.floor(size) === 0) ? 0 : 1;
  }

  options = this.prepareOptions(
    options,
    {precision: precision, format: "%n%u", delimiter: ""}
  );

  number = this.toNumber(size, options);
  number = options.format
    .replace("%u", unit)
    .replace("%n", number)
  ;

  return number;
};

I18n.toPercentage = function(number, options) {
  options = this.prepareOptions(
    options,
    this.lookup("number.percentage.format"),
    this.lookup("number.format"),
    {precision: 3, separator: ".", delimiter: ""}
  );

  number = this.toNumber(number, options);
  return number + "%";
};

I18n.pluralizer = function(locale) {
  var pluralizer = this.pluralizationRules[locale];
  if (pluralizer !== undefined) return pluralizer;
  return this.pluralizationRules["en"];
};

I18n.findAndTranslateValidNode = function(keys, translation) {
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (this.isValidNode(translation, key)) return translation[key];
  }
  return null;
};

I18n.pluralize = function(count, scope, options) {
  var translation;

  try { translation = this.lookup(scope, options); } catch (error) {}
  if (!translation) { return this.missingTranslation(scope); }

  options = this.prepareOptions(options);
  options.count = count.toString();

  var pluralizer = this.pluralizer(this.currentLocale());
  var key = pluralizer(Math.abs(count));
  var keys = ((typeof key == "object") && (key instanceof Array)) ? key : [key];

  var message = this.findAndTranslateValidNode(keys, translation);
  if (message == null) message = this.missingTranslation(scope, keys[0]);

  return this.interpolate(message, options);
};

I18n.missingTranslation = function(scope, key) {
  var message = '[' + this.currentLocale() + "." + scope;
  if (key) { message += "." + key; }
  return message + ']';
};

I18n.currentLocale = function() {
  return (I18n.locale || I18n.defaultLocale);
};

// shortcuts
I18n.t = I18n.translate;
I18n.l = I18n.localize;
I18n.p = I18n.pluralize;


MessageFormat = {locale: {}};
MessageFormat.locale.ja = function ( n ) {
  return "other";
};

I18n.messageFormat = (function(formats){
      var f = formats;
      return function(key, options) {
        var fn = f[key];
        if(fn){
          try {
            return fn(options);
          } catch(err) {
            return err.message;
          }
        } else {
          return 'Missing Key: ' + key
        }
        return f[key](options);
      };
    })({"topic.read_more_MF" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "UNREAD";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
r += "<a href='/unread'>未読ポスト1つ</a> ";
return r;
},
"other" : function(d){
var r = "";
r += "<a href='/unread'>未読ポスト" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "つ</a> ";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ja"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "NEW";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"0" : function(d){
var r = "";
return r;
},
"one" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>新規トピック1つ</a>c";
return r;
},
"other" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_2 = "BOTH";
var k_2=d[lastkey_2];
var off_1 = 0;
var pf_1 = { 
"true" : function(d){
var r = "";
r += "and ";
return r;
},
"false" : function(d){
var r = "";
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_1[ k_2 ] || pf_1[ "other" ])( d );
r += " <a href='/new'>新規トピック" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + "つ</a>";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["ja"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += "を読む or ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "CATEGORY";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"true" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["catLink"];
r += " の他のトピックを読む";
return r;
},
"false" : function(d){
var r = "";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["latestLink"];
return r;
},
"other" : function(d){
var r = "";
return r;
}
};
r += (pf_0[ k_1 ] || pf_0[ "other" ])( d );
r += " ";
return r;
}});I18n.translations = {"ja":{"js":{"number":{"human":{"storage_units":{"format":"%n %u","units":{"byte":{"one":"Byte","other":"Bytes"},"gb":"GB","kb":"KB","mb":"MB","tb":"TB"}}}},"dates":{"tiny":{"half_a_minute":"\u003C 1m","less_than_x_seconds":{"one":"\u003C 1s","other":"\u003C %{count}s"},"x_seconds":{"one":"1s","other":"%{count}s"},"less_than_x_minutes":{"one":"\u003C 1m","other":"\u003C %{count}m"},"x_minutes":{"one":"1m","other":"%{count}m"},"about_x_hours":{"one":"1h","other":"%{count}h"},"x_days":{"one":"1d","other":"%{count}d"},"about_x_years":{"one":"1y","other":"%{count}y"},"over_x_years":{"one":"\u003E 1y","other":"\u003E %{count}y"},"almost_x_years":{"one":"1y","other":"%{count}y"}},"medium":{"x_minutes":{"one":"1分","other":"%{count}分"},"x_hours":{"one":"1時間","other":"%{count}時間"},"x_days":{"one":"1日","other":"%{count}日"}},"medium_with_ago":{"x_minutes":{"one":"1分前","other":"%{count}分前"},"x_hours":{"one":"1時間前","other":"%{count}時間前"},"x_days":{"one":"1日前","other":"%{count}日前"}}},"share":{"topic":"このトピックのリンクをシェアする","post":"ポスト #%{postNumber} のリンクをシェアする","close":"閉じる","twitter":"Twitter でこのリンクを共有する","facebook":"Facebook でこのリンクを共有する","google+":"Google+ でこのリンクを共有する","email":"メールでこのリンクを送る"},"edit":"このトピックのタイトルとカテゴリを編集","not_implemented":"申し訳ありませんが、この機能はまだ実装されていません","no_value":"いいえ","yes_value":"はい","of_value":"/","generic_error":"申し訳ありませんが、エラーが発生しました","generic_error_with_reason":"エラーが発生しました: %{error}","log_in":"ログイン","age":"経過","last_post":"最終ポスト","admin_title":"管理者","flags_title":"フラグ","show_more":"もっと見る","links":"リンク","faq":"FAQ","privacy_policy":"プライバシーポリシー","mobile_view":"モバイル表示","desktop_view":"デスクトップ表示","you":"あなた","or":"or","now":"たった今","read_more":"もっと読む","more":"More","less":"Less","never":"never","daily":"毎日","weekly":"毎週","every_two_weeks":"隔週","character_count":{"one":"{{count}}文字","other":"{{count}}文字"},"in_n_seconds":{"one":"あと1秒","other":"あと{{count}}秒"},"in_n_minutes":{"one":"あと1分","other":"あと{{count}}分"},"in_n_hours":{"one":"あと1時間","other":"あと{{count}}時間"},"in_n_days":{"one":"あと1日","other":"あと{{count}}日"},"suggested_topics":{"title":"関連トピック"},"bookmarks":{"not_logged_in":"ポストをブックマークするには、ログインする必要があります","created":"このポストをブックマークしました","not_bookmarked":"このポストをブックマークする","last_read":"このポストをブックマークする"},"new_topics_inserted":"新しいトピックが {{count}}個あります","show_new_topics":"クリックして表示。","preview":"プレビュー","cancel":"キャンセル","save":"変更を保存","saving":"保存中...","saved":"保存しました","upload":"アップロード","uploading":"アップロード中...","uploaded":"アップロードしました","choose_topic":{"none_found":"トピックが見つかりませんでした","title":{"search":"トピック名、URL、または ID でトピックを検索:","placeholder":"ここにトピックのタイトルを入力"}},"user_action":{"user_posted_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E が \u003Ca href='{{topicUrl}}'\u003Eトピック\u003C/a\u003E を作成","you_posted_topic":"\u003Ca href='{{userUrl}}'\u003Eあなた\u003C/a\u003E が \u003Ca href='{{topicUrl}}'\u003Eトピック\u003C/a\u003E を作成","user_replied_to_post":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E が \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E に回答","you_replied_to_post":"\u003Ca href='{{userUrl}}'\u003Eあなた\u003C/a\u003E が \u003Ca href='{{postUrl}}'\u003E{{post_number}}\u003C/a\u003E に回答","user_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E が \u003Ca href='{{topicUrl}}'\u003Eトピック\u003C/a\u003E に回答","you_replied_to_topic":"\u003Ca href='{{userUrl}}'\u003Eあなた\u003C/a\u003E が \u003Ca href='{{topicUrl}}'\u003Eトピック\u003C/a\u003E に回答","user_mentioned_user":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E が \u003Ca href='{{user2Url}}'\u003E{{another_user}}\u003C/a\u003E をメンション","user_mentioned_you":"\u003Ca href='{{user1Url}}'\u003E{{user}}\u003C/a\u003E が \u003Ca href='{{user2Url}}'\u003Eあなた\u003C/a\u003E をメンション","you_mentioned_user":"\u003Ca href='{{user1Url}}'\u003Eあなた\u003C/a\u003E が \u003Ca href='{{user2Url}}'\u003E{{user}}\u003C/a\u003E をメンション","posted_by_user":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E がポストを投稿","posted_by_you":"\u003Ca href='{{userUrl}}'\u003Eあなた\u003C/a\u003E がポストを投稿","sent_by_user":"\u003Ca href='{{userUrl}}'\u003E{{user}}\u003C/a\u003E が送信","sent_by_you":"\u003Ca href='{{userUrl}}'\u003Eあなた\u003C/a\u003E が送信"},"user_action_groups":{"1":"「いいね！」 した","2":"「いいね！」 された","3":"ブックマーク","4":"トピック","5":"投稿","6":"リプライ","7":"メンション","9":"引用","10":"お気に入り","11":"編集","12":"アイテム送信","13":"インボックス"},"user":{"said":"{{username}} のコメント:","profile":"プロフィール","mute":"Mute","edit":"プロフィールを編集","download_archive":"ポストのアーカイブをダウンロード","private_message":"プライベートメッセージ","private_messages":"メッセージ","activity_stream":"アクティビティ","preferences":"プロフィール","bio":"自己紹介","invited_by":"招待者","trust_level":"トラストレベル","notifications":"通知","dynamic_favicon":"favicon に受信したメッセージ通知を表示する","external_links_in_new_tab":"外部リンクを全て新しいタブで開く","enable_quoting":"ハイライトしたテキストを引用して回答する","change":"変更","moderator":"{{user}} はモデレータです","admin":"{{user}} は管理者です","deleted":"(削除済)","messages":{"all":"すべて","mine":"私の","unread":"未読"},"change_password":{"success":"(メールを送信しました)","in_progress":"(メールを送信中)","error":"(エラー)","action":"パスワードリセット用メールを送信する"},"change_about":{"title":"自己紹介の変更"},"change_username":{"title":"ユーザ名の変更","confirm":"ユーザ名を変更すると、あなたのポストの引用と @ユーザ名 メンションのリンクが解除されます。本当にユーザ名を変更しますか？","taken":"このユーザ名は既に使われています。","error":"ユーザ名変更中にエラーが発生しました。","invalid":"このユーザ名は無効です。英数字のみ利用可能です。"},"change_email":{"title":"メールドレスの変更","taken":"このメールアドレスは既に使われています。","error":"メールアドレス変更中にエラーが発生しました。既にこのアドレスが使われているのかもしれません。","success":"このアドレスにメールを送信しました。メールの指示に従って確認処理を行ってください。"},"change_avatar":{"title":"アバターの変更","gravatar":"\u003Ca href='//gravatar.com/emails' target='_blank'\u003EGravatar\u003C/a\u003E, based on","gravatar_title":"ウェブサイトのアバターを変更","uploaded_avatar":"カスタム画像","uploaded_avatar_empty":"カスタム画像を追加","upload_title":"画像をアップロード","image_is_not_a_square":"警告: 画像が正方形ではなかったためクロップしました。"},"email":{"title":"メールアドレス","instructions":"メールアドレスが外部に公開されることは一切ありません。","ok":"メールアドレス OK。確認用のメールを送ります。","invalid":"正しいメールアドレスを入力してください。","authenticated":"あたなのメールは {{provider}} により認証されました。","frequency":"メールは、あなたがしばらくの間サイトにログインせず未読トピックが溜まった時のみ送信されます。"},"name":{"title":"名前","instructions":"フルネーム。ユニークである必要はありません。@ユーザ名 によるマッチングの代わりに利用可能であり、あなたのページのみに表示されます。","too_short":"名前が短すぎいます。","ok":"名前 OK。"},"username":{"title":"ユーザ名","instructions":"空白を含まないユニークな名前を入力してください。他のユーザはあなたを @ユーザ名 でメンションできます。","short_instructions":"他のユーザはあなたを @ユーザ名 でメンションできます。","available":"ユーザ名は利用可能です。","global_match":"メールアドレスが登録済のユーザ名と一致しました。","global_mismatch":"既に利用されています。{{suggestion}} などはいかがでしょう？","not_available":"利用できません。{{suggestion}} などはいかがでしょう？","too_short":"ユーザ名が短すぎます。","too_long":"ユーザ名が長すぎます。","checking":"ユーザ名が利用可能か確認しています...","enter_email":"ユーザ名が見つかりました。メールアドレスを入力してください。"},"password_confirmation":{"title":"もう一度パスワードを入力してください。"},"last_posted":"最終投稿","last_emailed":"最終メール","last_seen":"最終アクティビティ","created":"作成","log_out":"ログアウト","website":"ウェブサイト","email_settings":"メール","email_digests":{"title":"新規トピックのダイジェストをメールで受信する","daily":"毎日","weekly":"毎週","bi_weekly":"隔週"},"email_direct":"ポストが引用されたり、回答を受けたり、 @ユーザ名 でメンションを受けた際にメール通知を受ける","email_private_messages":"プライベートメッセージを受けた際にメール通知を受ける","other_settings":"その他","new_topic_duration":{"label":"以下の条件でトピックを新規と見なす","not_viewed":"未読のもの","last_here":"前回ログアウト後に投稿されたもの","after_n_days":{"one":"1日前に投稿されたもの","other":"過去{{count}}日に投稿されたもの"},"after_n_weeks":{"one":"先週投稿されたもの","other":"過去{{count}}週に投稿されたもの"}},"auto_track_topics":"以下のタイミングで、自分が投稿したトピックを自動的にトラックする","auto_track_options":{"never":"トラックしない","always":"常にトラックする","after_n_seconds":{"one":"1秒後","other":"{{count}}秒後"},"after_n_minutes":{"one":"1分後","other":"{{count}}分後"}},"invited":{"title":"招待","user":"招待したユーザ","none":"{{username}} はこのサイトに誰も招待していません。","redeemed":"受理された招待","redeemed_at":"受理日","pending":"保留中の招待","topics_entered":"参加したトピック","posts_read_count":"読んだポスト","rescind":"招待の取り消し","rescinded":"取り消された招待","time_read":"リード時間","days_visited":"訪問日数","account_age_days":"アカウント有効日数"},"password":{"title":"パスワード","too_short":"パスワードが短すぎます。","ok":"パスワード OK。"},"ip_address":{"title":"最終 IP アドレス"},"avatar":{"title":"アバター"},"title":{"title":"タイトル"},"filters":{"all":"すべて"},"stream":{"posted_by":"投稿者","sent_by":"送信者","private_message":"プライベートメッセージ","the_topic":"トピック"}},"loading":"読み込み中...","close":"閉じる","learn_more":"より詳しく...","year":"ポスト/年","year_desc":"過去365日間に投稿されたトピック","month":"ポスト/月","month_desc":"過去30日間に投稿されたトピック","week":"ポスト/週","week_desc":"過去7日間に投稿されたトピック","first_post":"最初のポスト","mute":"ミュート","unmute":"ミュート解除","best_of":{"title":"ベストのみ","enabled_description":"このトピックのベストポストのみが表示されています。すべてのポストを再度表示するには、下をクリックしてください。","description":"このトピックには\u003Cb\u003E{{count}}\u003C/b\u003E個のポストがあります。ベストポストのみを表示しますか?","enable":"\"ベストのみ\" 表示に切り替える","disable":"\"ベストのみ\" 表示をキャンセルする"},"private_message_info":{"title":"プライベートメッセージ","invite":"友人を招待..."},"email":"メール","username":"ユーザ名","last_seen":"最終アクティビティ","created":"作成","trust_level":"トラストレベル","create_account":{"title":"アカウントの作成","action":"今すぐアカウントを作成しましょう!","invite":"まだアカウントをもっていない?","failed":"エラーが発生しました。既にこのメールアドレスは使用中かもしれません。「パスワードを忘れました」リンクを試してみてください"},"forgot_password":{"title":"パスワードを忘れました","action":"パスワードを忘れました","invite":"ユーザ名かメールアドレスを入力してください。パスワードリセット用のメールを送信します。","reset":"パスワードをリセット","complete":"パスワードリセット用のメールを送信しました。"},"login":{"title":"ログイン","username":"ログイン名","password":"パスワード","email_placeholder":"メールアドレスかユーザ名","error":"不明なエラー","reset_password":"パスワードをリセット","logging_in":"ログイン中...","or":"または","authenticating":"認証中...","awaiting_confirmation":"アカウントはアクティベーション待ち状態です。もう一度アクティベーションメールを送信するには「パスワードを忘れました」リンクをクリックしてください。","awaiting_approval":"アカウントはまだスタッフメンバーに承認されていません。承認され次第メールにてお知らせいたします。","requires_invite":"申し訳ありませんが、このフォーラムは招待制です。","not_activated":"まだログインできません。\u003Cb\u003E{{sentTo}}\u003C/b\u003E にアクティベーションメールを送信しております。メールの指示に従ってアカウントのアクティベーションを行ってください。","resend_activation_email":"再度アクティベーションメールを送信するにはここをクリックシてください。","sent_activation_email_again":"\u003Cb\u003E{{currentEmail}}\u003C/b\u003E にアクティベーションメールを再送しました。メール到着まで数分かかることがあります (いつまで立ってもメールが届かない場合は、念のためスパムフォルダの中も確認してみてください)。","google":{"title":"with Google","message":"Google による認証 (ポップアップがブロックされていないことを確認してください)"},"twitter":{"title":"with Twitter","message":"Twitter による認証 (ポップアップがブロックされていないことを確認してください)"},"facebook":{"title":"with Facebook","message":"Facebook による認証 (ポップアップがブロックされていないことを確認してください)"},"cas":{"title":"Log In with CAS","message":"CAS による認証 (ポップアップがブロックされていないことを確認してください)"},"yahoo":{"title":"with Yahoo","message":"Yahoo による認証 (ポップアップがブロックされていないことを確認してください)"},"github":{"title":"with GitHub","message":"Github による認証 (ポップアップがブロックされていないことを確認してください)"},"persona":{"title":"with Persona","message":"Persona による認証 (ポップアップがブロックされていないことを確認してください)"}},"composer":{"posting_not_on_topic":"回答したいトピックはどれですか?","saving_draft_tip":"保存中","saved_draft_tip":"保存しました","saved_local_draft_tip":"ローカルに保存しました","similar_topics":"このトピックに似ているトピック...","drafts_offline":"オフラインで下書き","min_length":{"need_more_for_title":"タイトルにあと{{n}}文字必要","need_more_for_reply":"ポストにあと{{n}}文字必要"},"error":{"title_missing":"タイトルを入力してください。","title_too_short":"タイトルは{{min}}文字以上必要です。","title_too_long":"タイトルは最長で{{max}}未満です。","post_missing":"ポスト内容が空です。","post_length":"ポストは{{min}}文字以上必要です。","category_missing":"カテゴリを選択してください。"},"save_edit":"編集内容を保存","reply_original":"元のトピックに回答","reply_here":"ここに回答","reply":"回答","cancel":"キャンセル","create_topic":"トピックを作成","create_pm":"プライベートメッセージの作成","users_placeholder":"Add a user","title_placeholder":"トピックのタイトルをここに入力してください。","reply_placeholder":"本文をここに入力してください。Markdown や BBCode を利用することもできます。画像をアップロードするにはドラッグまたはペーストしてください。","view_new_post":"新規ポストを見る。","saving":"保存中...","saved":"保存完了!","saved_draft":"編集中のポストがあります。このボックス内をクリックすると編集を再開できます。","uploading":"アップロード中...","show_preview":"プレビューを表示する \u0026raquo;","hide_preview":"\u0026laquo; プレビューを隠す","quote_post_title":"ポスト全体を引用","bold_title":"強調","bold_text":"強調されたテキスト","italic_title":"斜体","italic_text":"斜体のテキスト","link_title":"ハイパーリンク","link_description":"リンクの説明文をここに入力","link_dialog_title":"ハイパーリンクの挿入","link_optional_text":"タイトル(オプション)","quote_title":"ブロック引用","quote_text":"ブロック引用","code_title":"コードサンプル","code_text":"コードサンプルをここに入力","upload_title":"アップロード","upload_description":"アップロード内容の説明文をここに入力","olist_title":"番号付きリスト","ulist_title":"箇条書き","list_item":"リストアイテム","heading_title":"見出し","heading_text":"見出し","hr_title":"水平線","undo_title":"やり直し","redo_title":"やり直しのやり直し","help":"Markdown 編集のヘルプ","toggler":"編集パネルの表示/非表示","admin_options_title":"このトピックの詳細設定","auto_close_label":"このトピックを","auto_close_units":"日後に自動的に終了する"},"notifications":{"title":"@ユーザ名 メンションやあなたのポストやトピックへの回答、プライベートメッセージなどの通知","none":"現在通知はありません。","more":"古い通知を確認する","mentioned":"\u003Cspan title='mentioned' class='icon'\u003E@\u003C/span\u003E {{username}} {{link}}","quoted":"\u003Ci title='quoted' class='icon icon-quote-right'\u003E\u003C/i\u003E {{username}} {{link}}","replied":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","posted":"\u003Ci title='replied' class='icon icon-reply'\u003E\u003C/i\u003E {{username}} {{link}}","edited":"\u003Ci title='edited' class='icon icon-pencil'\u003E\u003C/i\u003E {{username}} {{link}}","liked":"\u003Ci title='liked' class='icon icon-heart'\u003E\u003C/i\u003E {{username}} {{link}}","private_message":"\u003Ci class='icon icon-envelope-alt' title='private message'\u003E\u003C/i\u003E {{username}} {{link}}","invited_to_private_message":"\u003Ci class='icon icon-envelope-alt' title='private message'\u003E\u003C/i\u003E {{username}} {{link}}","invitee_accepted":"\u003Ci title='accepted your invitation' class='icon icon-signin'\u003E\u003C/i\u003E {{username}} が招待を受理しました","moved_post":"\u003Ci title='moved post' class='icon icon-arrow-right'\u003E\u003C/i\u003E {{username}} が {{link}} を移動しました","total_flagged":"フラグがたったポストの総数"},"upload_selector":{"title":"画像のアップロード","title_with_attachments":"画像/ファイルをアップロード","from_my_computer":"このデバイスから","from_the_web":"Web から","add_title":"画像を追加","add_title_with_attachments":"画像/ファイルを追加","remote_title":"リモートの画像","remote_title_with_attachments":"リモートの画像/ファイル","remote_tip":"画像のアドレスを入力してください (例 http://example.com/image.jpg)。","remote_tip_with_attachments":"画像/ファイルのアドレスを入力してください (例 http://example.com/file.ext) (使用可能な拡張子: {{authorized_extensions}}).","local_title":"ローカルの画像","local_title_with_attachments":"ローカルの画像/ファイル","local_tip":"クリックしてアップロードする画像を選択してください","local_tip_with_attachments":"クリックしてアップロードする画像/ファイルを選択してください (使用可能な拡張子: {{authorized_extensions}})","upload_title":"画像をアップロード","upload_title_with_attachments":"画像やファイルをアップロード","uploading":"アップロード中"},"search":{"title":"トピック、ポスト、ユーザ、カテゴリを探す","placeholder":"検索ワードを入力してください","no_results":"何も見つかりませんでした。","searching":"検索中...","prefer":{"user":"検索結果は @{{username}} を優先します","category":"検索結果は {{category}} を優先します"}},"site_map":"別のトピックリストやカテゴリに移動","go_back":"戻る","current_user":"ユーザページに移動","favorite":{"title":"お気に入り","help":{"star":"このトピックをお気に入りに登録","unstar":"このトピックをお気に入りより削除"}},"topics":{"none":{"favorited":"お気に入り登録しているトピックがありません。お気に入り登録するには、タイトル横のスターをクリック/タップしてください。","unread":"未読トピックはありません。","new":"新着トピックはありません。","read":"またトピックを一つも読んでいません。","posted":"まだトピックを一つも投稿していません。","latest":"最新のトピックはありません。","hot":"ホットなトピックはありません。","category":"{{category}} トピックはありません。"},"bottom":{"latest":"最新のトピックは以上です。","hot":"ホットなトピックは以上です。","posted":"ポストのあるトピックは以上です。","read":"未読トピックは以上です。","new":"新規トピックは以上です。","unread":"未読のトピックは以上です。","favorited":"お気に入りしたトピックは以上です。","category":"{{category}} トピックは以上です。"}},"rank_details":{"toggle":"トピックランクの詳細をトグル","show":"トピックランクの詳細を表示","title":"トピックランクの詳細"},"topic":{"create_in":"{{categoryName}} トピックを作成","create":"トピックを作成する","create_long":"新しいトピックの作成","private_message":"プライベートメッセージを作成","list":"トピック","new":"新規トピック","title":"トピック","loading_more":"さらにトピックを読み込み中...","loading":"トピックを読み込み中...","invalid_access":{"title":"トピックはプライベートです","description":"申し訳ありませんが、このトピックへのアクセスは許可されていません!"},"server_error":{"title":"トピックの読み込みに失敗しました","description":"申し訳ありませんが、トピックの読み込みに失敗しました。もう一度試してください。もし問題が継続する場合はお知らせください。"},"not_found":{"title":"トピックが見つかりませんでした","description":"申し訳有りませんがトピックが見つかりませんでした。モデレータによって削除された可能性があります。"},"unread_posts":{"one":"このトピックに未読のポストが1つあります","other":"このトピックに未読のポストが{{count}}つあります"},"new_posts":{"one":"前回閲覧時より、このトピックに新しいポストが1つ投稿されています","other":"前回閲覧時より、このトピックに新しいポストが{{count}}個投稿されています"},"likes":{"one":"このトピックには1個「いいね！」がついています","other":"このトピックには{{count}}個「いいね！」がついています"},"back_to_list":"トピックリストに戻る","options":"トピックオプション","show_links":"このトピック内のリンクを表示","toggle_information":"トピック詳細をトグル","read_more_in_category":"{{catLink}} の他のトピックを見る or {{latestLink}}。","read_more":"{{catLink}} or {{latestLink}}。","browse_all_categories":"全てのカテゴリをブラウズする","view_latest_topics":"最新のトピックを見る","suggest_create_topic":"新しいトピックを作成しますか？","read_position_reset":"しおりがリセットされました。","jump_reply_up":"以前の回答へジャンプ","jump_reply_down":"以後の回答へジャンプ","deleted":"トピックは削除されました","auto_close_notice":"このトピックは%{timeLeft}で自動的に終了します。","auto_close_title":"自動終了設定","auto_close_save":"保存","auto_close_cancel":"キャンセル","auto_close_remove":"このトピックを自動終了しない","progress":{"title":"トピック進捗","jump_top":"最初のポストにジャンプ","jump_bottom":"最後のポストにジャンプ","total":"ポスト総数","current":"現在のポスト"},"notifications":{"title":"","reasons":{"3_2":"このトピックを監視中のため通知されます。","3_1":"このトピックを作成したため通知されます。","3":"このトピックを監視中のため通知されます。","2_4":"このトピックに回答したため通知されます。","2_2":"このトピックをトラック中のため通知されます。","2":"\u003Ca href=\"/users/{{username}}/preferences\"\u003Eこのトピックを閲覧した\u003C/a\u003Eため通知されます。","1":"誰かから @ユーザ名 でメンションを受けた際と、あなたのポストに回答がついた際に通知されます。","1_2":"誰かから @ユーザ名 でメンションを受けた際と、あなたのポストに回答がついた際に通知されます。","0":"このトピックに関して一切通知を受けません。","0_2":"このトピックに関して一切通知を受けません。"},"watching":{"title":"監視中","description":"トラック中と同様です。加えて、新規ポストが投稿されるたびに通知されます。"},"tracking":{"title":"トラック中","description":"誰かから @ユーザ名 でメンションを受けた際と、あなたのポストに回答がついた際に通知されます。これに加えて、未読および新規ポストの数を確認します。"},"regular":{"title":"通常","description":"誰かから @ユーザ名 でメンションを受けた際と、あなたのポストに回答がついた際に通知されます。"},"muted":{"title":"ミュート","description":"このトピックについて何の通知も受けません。また未読タブにも表示されません。"}},"actions":{"recover":"トピック削除の取り消し","delete":"トピック削除","open":"トピックを開く","close":"トピックを終了する","auto_close":"自動終了","unpin":"トピックのピン留め解除","pin":"トピックのピン留め","unarchive":"トピックのアーカイブ解除","archive":"トピックのアーカイブ","invisible":"非表示にする","visible":"非表示を解除","reset_read":"読み込みデータをリセット","multi_select":"移動するポストを選択","convert_to_topic":"通常トピックに変換"},"reply":{"title":"回答","help":"このトピックに回答する"},"clear_pin":{"title":"ピンを解除する","help":"このトピックのピンを解除し、トピックリストの先頭に表示されないようにする"},"share":{"title":"シェア","help":"このトピックへのリンクをシェアする"},"inviting":"招待中...","invite_private":{"title":"プライベートメッセージへの招待","email_or_username":"招待するユーザのメールアドレスまたはユーザ名","email_or_username_placeholder":"メールアドレスまたはユーザ名","action":"招待","success":"このプライベートメッセージにユーザを招待しました。","error":"申し訳ありませんが、ユーザ招待中にエラーが発生しました。"},"invite_reply":{"title":"友人を招待して回答してもらう","action":"メールで招待","help":"このトピックにワンクリックで回答ができるように友人を招待メールを送る","email":"このトピックに（ログインすることなく）ワンクリックで回答ができるようにあなたの友人にメールを送ります","email_placeholder":"メールアドレス","success":"ありがとうございます! \u003Cb\u003E{{email}}\u003C/b\u003E 宛に招待メールを送信しました。友人により招待が受理されたらお知らせします。招待した友人の一覧は、ユーザページの招待タブにて確認できます。","error":"申し訳ありませんが招待に失敗しました。既にユーザ登録済かもしれません。"},"login_reply":"ログインして回答","filters":{"user":"You're viewing only {{n_posts}} {{by_n_users}}.","n_posts":{"one":"1 post","other":"{{count}} posts"},"by_n_users":{"one":"made by 1 specific user","other":"made by {{count}} specific users"},"best_of":"You're viewing the {{n_best_posts}} {{of_n_posts}}.","n_best_posts":{"one":"1 best post","other":"{{count}} best posts"},"of_n_posts":{"one":"of 1 in the topic","other":"of {{count}} in the topic"},"cancel":"Show all posts in this topic again."},"split_topic":{"title":"新規トピックに移動","action":"新規トピックに移動","topic_name":"新規トピック名:","error":"新規トピックへのポスト移動中にエラーが発生しました。","instructions":{"one":"新たにトピックを作成し、選択したポストをこのトピックに移動しようとしています。","other":"新たにトピックを作成し、選択した\u003Cb\u003E{{count}}\u003C/b\u003E個のポストをこのトピックに移動しようとしています。"}},"merge_topic":{"title":"既存トピックに移動","action":"既存トピックに移動","error":"指定トピックへのポスト移動中にエラーが発生しました。","instructions":{"one":"このポストをどのトピックに移動するか選択してください。","other":"これら\u003Cb\u003E{{count}}\u003C/b\u003E個のポストをどのトピックに移動するか選択してください。"}},"multi_select":{"select":"選択","selected":"選択中 ({{count}})","select_replies":"全ての回答と共に選択","delete":"選択中のものを削除","cancel":"deselect all","description":{"one":"現在\u003Cb\u003E1\u003C/b\u003E個のポストを選択中。","other":"現在\u003Cb\u003E{{count}}\u003C/b\u003E個のポストを選択中。"}}},"post":{"reply":"{{replyAvatar}} {{username}} による {{link}} に回答","reply_topic":"{{link}} に回答","quote_reply":"引用して回答","edit":"{{replyAvatar}} {{username}} による {{link}} を編集","post_number":"ポスト{{number}}","in_reply_to":"こちらへの回答","last_edited_on":"ポストの最終編集日","reply_as_new_topic":"新規トピックとして回答","continue_discussion":"{{postLink}} からの議論を継続:","follow_quote":"引用ポストに移動","deleted_by_author":{"one":"(ポストは執筆者により取り下げられました。フラグがつかない場合%{count}時間後に自動的に削除されます)","other":"(ポストは執筆者により取り下げられました。フラグがつかない場合%{count}時間後に自動的に削除されます)"},"deleted_by":"削除者","expand_collapse":"展開/折りたたみ","has_replies":{"one":"回答","other":"回答"},"errors":{"create":"申し訳ありませんが、ポスト作成中にエラーが発生しました。もう一度やり直してください。","edit":"申し訳ありませんが、ポスト編集中にエラーが発生しました。もう一度やり直してください。","upload":"申し訳ありませんが、ファイルアップロード中にエラーが発生しました。もう一度やり直してください。","attachment_too_large":"申し訳ありませんが、アップロード対象ファイルが大きすぎます (最大サイズは {{max_size_kb}}kb)。","image_too_large":"申し訳ありませんが、アップロード対象ファイルが大きすぎます (最大サイズは {{max_size_kb}}kb)。","too_many_uploads":"申し訳ありませんが、複数のファイルは同時にアップロードできません。","upload_not_authorized":"申し訳ありませんが、対象ファイルをアップロードする権限がありません (利用可能な拡張子: {{authorized_extensions}}).","image_upload_not_allowed_for_new_user":"申し訳ありませんが、新規ユーザは画像のアップロードができません。","attachment_upload_not_allowed_for_new_user":"申し訳ありませんが、新規ユーザはファイルの添付ができません。"},"abandon":"編集中のポストを破棄してもよろしいですか?","archetypes":{"save":"保存オプション"},"controls":{"reply":"このポストに対する回答の編集を開始","like":"このポストを「いいね！」する","edit":"このポストを編集","flag":"このポストにフラグをつける、または通知を送る","delete":"このポストを削除する","undelete":"このポストを復帰する","share":"このポストのリンクをシェアする","more":"もっと読む","delete_replies":{"confirm":{"one":"このポストに対する回答も削除しますか?","other":"このポストに対する{{count}}個の回答を削除しますか?"},"yes_value":"はい、回答も一緒に削除する","no_value":"いいえ、ポストのみ削除する"}},"actions":{"flag":"フラグ","clear_flags":{"one":"フラグをクリア","other":"フラグをクリア"},"it_too":{"off_topic":"フラグをたてる","spam":"フラグをたてる","inappropriate":"フラグをたてる","custom_flag":"フラグをたてる","bookmark":"ブックマークする","like":"あなたも「いいね！」する","vote":"投票する"},"undo":{"off_topic":"フラグを取り消す","spam":"フラグを取り消す","inappropriate":"フラグを取り消す","bookmark":"ブックマークを取り消す","like":"「いいね！」を取り消す","vote":"投票を取り消す"},"people":{"off_topic":"{{icons}} がオフトピックであるとマークしました","spam":"{{icons}} がスパムであるとマークしました","inappropriate":"{{icons}} が不適切であるとマークしました","notify_moderators":"{{icons}} がモデレータに通報しました","notify_moderators_with_url":"{{icons}} \u003Ca href='{{postUrl}}'\u003E通知されたモデレータ\u003C/a\u003E","notify_user":"{{icons}} がプライベートメッセージを送信しました","notify_user_with_url":"{{icons}} が\u003Ca href='{{postUrl}}'\u003Eプライベートメッセージe\u003C/a\u003Eを送信しました","bookmark":"{{icons}} がブックマークしました","like":"{{icons}} が「いいね！」しています","vote":"{{icons}} が投票しました"},"by_you":{"off_topic":"あなたがオフトピックであるとフラグをたてました","spam":"あなたがスパムであるとフラグを立てています","inappropriate":"あなたが不適切であるとフラグをたてました","notify_moderators":"あなたがモデレータ確認を要するとフラグをたてました","notify_user":"あなたがこのユーザにプライベートメッセージを送信しました","bookmark":"あなたがこのポストをブックマークしました","like":"あなたが「いいね！」しました","vote":"あなたがこのポストに投票しました"},"by_you_and_others":{"off_topic":{"one":"あなたともう1人がオフトピックであるとフラグをたてました","other":"あなたと他{{count}}人がオフトピックであるとフラグをたてました"},"spam":{"one":"あなたともう1人がスパムであるとフラグをたてました","other":"あなたと他{{count}}人がスパムであるとフラグをたてました"},"inappropriate":{"one":"あなたともう1人が不適切であるとフラグをたてました","other":"あなたと他{{count}}人が不適切であるとフラグをたてました"},"notify_moderators":{"one":"あなたともう1人がモデレータ確認を要するとフラグをたてました","other":"あなたと他{{count}}人がモデレータ確認を要するとフラグをたてました"},"notify_user":{"one":"あなたともう1人がこのユーザにプライベートメッセージを送信しました","other":"あなたと他{{count}}人がこのユーザにプライベートメッセージを送信しました"},"bookmark":{"one":"あなたともう1人がこのポストをブックマークしました","other":"あなたと他{{count}}人がこのポストをブックマークしました"},"like":{"one":"あなたと他1人が「いいね！」しました","other":"あなたと他{{count}}人が「いいね！」しました"},"vote":{"one":"あなたともう1人がこのポストに投票しました","other":"あなたと他{{count}}人がこのポストに投票しました"}},"by_others":{"off_topic":{"one":"1人のユーザがオフトピックであるとフラグをたてました","other":"{{count}}人のユーザがオフトピックであるとフラグをたてました"},"spam":{"one":"1人のユーザがスパムであるとフラグをたてました","other":"{{count}}人のユーザがスパムであるとフラグをたてました"},"inappropriate":{"one":"1人のユーザが不適切であるとフラグをたてました","other":"{{count}}人のユーザが不適切であるとフラグをたてました"},"notify_moderators":{"one":"1人のユーザがモデレータ確認を要するとフラグをたてました","other":"{{count}}人のユーザがモデレータ確認を要するとフラグをたてました"},"notify_user":{"one":"1人のユーザがこのユーザにプライベートメッセージを送信しました","other":"{{count}}人のユーザがこのユーザにプライベートメッセージを送信しました"},"bookmark":{"one":"1人のユーザがこのポストをブックマークしました","other":"{{count}}人のユーザがこのポストをブックマークしました"},"like":{"one":"1人のユーザが「いいね！」しました","other":"{{count}}人のユーザが「いいね！」しました"},"vote":{"one":"1人のユーザがこのポストに投票しました","other":"{{count}}人のユーザがこのポストに投票しました"}}},"edits":{"one":"1回編集","other":"{{count}}回編集","zero":"編集なし"},"delete":{"confirm":{"one":"本当にこのポストを削除しますか?","other":"本当にこれらのポストを削除しますか?"}}},"category":{"can":"can\u0026hellip; ","none":"(カテゴリなし)","edit":"編集","edit_long":"カテゴリを編集","edit_uncategorized":"カテゴリなしを編集","view":"カテゴリ内のトピックを見る","general":"一般","settings":"設定","delete":"カテゴリを削除する","create":"カテゴリを作成する","save":"カテゴリを保存する","creation_error":"カテゴリの作成に失敗しました。","save_error":"カテゴリの保存に失敗しました。","more_posts":"{{posts}}個のポストをすべて見る...","name":"カテゴリ名","description":"カテゴリ内容","topic":"カテゴリトピック","badge_colors":"バッジの色","background_color":"背景色","foreground_color":"文字表示色","name_placeholder":"簡潔な名前にしてください。","color_placeholder":"任意の Web カラー","delete_confirm":"本当にこのカテゴリを削除してもよいですか?","delete_error":"カテゴリ削除に失敗しました。","list":"カテゴリをリストする","no_description":"このカテゴリの説明はありません。トピック定義を編集してください。","change_in_category_topic":"カテゴリ内容を編集","hotness":"ホット度","already_used":"この色は他のカテゴリで利用しています","security":"セキュリティ","auto_close_label":"","edit_permissions":"パーミッションを編集","add_permission":"パーミッションを追加"},"flagging":{"title":"このポストにフラグをつける理由は何ですか?","action":"フラグをつける","take_action":"アクションを取る","notify_action":"通知する","delete_spammer":"スパマーの削除","delete_confirm":"このユーザによる\u003Cb\u003E%{posts}\u003C/b\u003E個のポストと\u003Cb\u003E%{topics}\u003C/b\u003E個のトピックを削除し、アカウントを削除し、このユーザのメールアドレス \u003Cb\u003E%{email}\u003C/b\u003E をブロックリストに追加しようとしています。本当にこのユーザをスマパー認定してもよいですか?","yes_delete_spammer":"はい、スパマーを削除する","cant":"申し訳ありませんが、現在このポストにフラグをたてることはできません。","custom_placeholder_notify_user":"ポストについて、このユーザに個人的に直接確認する必要がある内容を書いてください。詳細かつ建設的に、そして何よりマナーを守った内容にしてください。","custom_placeholder_notify_moderators":"ポストについて、モデレータの確認が必要な理由を書いてください。問題の詳細を書くとともに、可能であれば参照リンクなども加えてください。","custom_message":{"at_least":"少なくとも{{n}}文字入力してください","more":"あと{{n}}文字...","left":"残り{{n}}文字"}},"topic_summary":{"title":"トピック要約","links_shown":"{{totalLinks}} のリンクを全て表示...","clicks":"クリック","topic_link":"トピックリンク"},"topic_statuses":{"locked":{"help":"このトピックは終了しています。新たに回答を投稿することはできません\""},"pinned":{"help":"このトピックはピン留めされています。常にカテゴリのトップに表示されます"},"archived":{"help":"このトピックはアーカイブされています。凍結状態のため一切の変更ができません"},"invisible":{"help":"このトピックは非表示状態です。トピックリストには表示されません。直接リンクでのみアクセス可能です"}},"posts":"投稿","posts_long":"このトピックには{{number}}個のポストがあります","original_post":"大元のポスト","views":"閲覧","replies":"回答","views_long":"このトピックは{{number}}回閲覧されました","activity":"アクティビティ","likes":"いいね！","likes_long":"このトピックには{{number}}つ「いいね！」がついています","top_contributors":"主な参加者","category_title":"カテゴリ","history":"History","changed_by":"by {{author}}","categories_list":"カテゴリ一覧","filters":{"latest":{"title":"最新","help":"最新のトピック"},"hot":{"title":"ホット","help":"話題のトピック"},"favorited":{"title":"お気に入り","help":"お気に入りしたトピック"},"read":{"title":"既読","help":"既読のトピックを、最後に読んだ順に表示"},"categories":{"title":"カテゴリ","title_in":"カテゴリ - {{categoryName}}","help":"カテゴリ毎に整理されたトピックを表示"},"unread":{"title":{"zero":"未読","one":"未読 (1)","other":"未読 ({{count}})"},"help":"未読ポストのあるトピック"},"new":{"title":{"zero":"新規","one":"新規 (1)","other":"新規 ({{count}})"},"help":"前回ログイン時からの新規トピック"},"posted":{"title":"あなたのポスト","help":"あなたが投稿したトピック"},"category":{"title":{"zero":"{{categoryName}}","one":"{{categoryName}} (1)","other":"{{categoryName}} ({{count}})"},"help":"{{categoryName}} カテゴリの最新トピック"}},"browser_update":"\u003Ca href=\"http://www.discourse.org/faq/#browser\"\u003Eご使用中のブラウザが古すぎるため Discourse フォーラムが正しく動作しません\u003C/a\u003E。\u003Ca href=\"http://browsehappy.com\"\u003Eブラウザをアップグレードしてください\u003C/a\u003E。","permission_types":{"full":"作成できる / 回答できる / 閲覧できる","create_post":"回答できる / 閲覧できる","readonly":"閲覧できる"},"type_to_filter":"ファルタのタイプ...","admin":{"title":"Discourse 管理者","moderator":"モデレータ","dashboard":{"title":"ダッシュボード","last_updated":"ダッシュボード最終更新:","version":"Version","up_to_date":"最新のバージョンです!","critical_available":"重要度の高いアップデートが存在します。","updates_available":"アップデートが存在します。","please_upgrade":"今すぐアップデートしてください!","no_check_performed":"アップデートの確認が正しく動作していません。sidekiq が起動していることを確認してください。","stale_data":"最近アップデートの確認が正しく動作していません。sidekiq が起動していることを確認してください。","installed_version":"Installed","latest_version":"Latest","problems_found":"Discourse のインストールにいくつか問題が発見されました:","last_checked":"最終チェック","refresh_problems":"更新","no_problems":"問題は見つかりませんでした。","moderators":"モデレータ:","admins":"管理者:","blocked":"ブロック中:","banned":"追放中:","private_messages_short":"PMs","private_messages_title":"プライベートメッセージ","reports":{"today":"今日","yesterday":"昨日","last_7_days":"過去7日","last_30_days":"過去30日","all_time":"All Time","7_days_ago":"7日前","30_days_ago":"30日前","all":"全て","view_table":"テーブル表示","view_chart":"棒グラフ表示"}},"commits":{"latest_changes":"最新の更新内容: 定期的にアップデートしてください!","by":"by"},"flags":{"title":"フラグ","old":"古いフラグ","active":"アクティブなフラグ","agree_hide":"賛成 (ポストを非表示 + PM を送信)","agree_hide_title":"このポストを非表示にし、編集を促すプライベートメッセージを自動的に送信","defer":"保留","defer_title":"現時点ではアクション不要。保留状態にしておき後ほど再判断","delete_post":"ポストを削除","delete_post_title":"ポストを削除。最初のポストの場合はトピックも合わせて削除","disagree_unhide":"反対 (ポストを再表示)","disagree_unhide_title":"このポストのフラグをクリアし、再度表示","disagree":"反対","disagree_title":"フラグに反対。このポストのフラグをクリア","delete_spammer_title":"ユーザを削除し、全てのポストとトピックを削除。","flagged_by":"フラグをたてた人","error":"何かがうまくいきませんでした","view_message":"回答","no_results":"フラグはありません。","summary":{"action_type_3":{"one":"オフトピック","other":"オフトピック x{{count}}"},"action_type_4":{"one":"不適切","other":"不適切 x{{count}}"},"action_type_6":{"one":"カスタム","other":"カスタム x{{count}}"},"action_type_7":{"one":"カスタム","other":"カスタム x{{count}}"},"action_type_8":{"one":"スパム","other":"スパム x{{count}}"}}},"groups":{"title":"グループ","edit":"グループの編集","selector_placeholder":"ユーザの追加","name_placeholder":"グループ名を入力 (ユーザ名同様にスペースなし)","about":"グループメンバーとグループ名を編集","can_not_edit_automatic":"自動作成グループのメンバーは自動的に決まります (管理者ユーザによってロールとトラストレベルが設定されます)","delete":"削除","delete_confirm":"このグループを削除しますか?","delete_failed":"グループの削除に失敗しました。自動作成グループを削除することはできません。"},"api":{"title":"API","long_title":"API 情報","key":"Key","generate":"API キーを生成","regenerate":"API キーを再生成","info_html":"API キーを使うと、JSON 呼び出しでトピックの作成・更新を行うことが出来ます。","note_html":"このキーは\u003Cstrong\u003E秘密\u003C/strong\u003E情報です。キーを知るユーザは、任意のユーザとして任意のポストを作成することができます。"},"customize":{"title":"カスタマイズ","long_title":"サイトのカスタマイズ","header":"ヘッダ","css":"スタイルシート","override_default":"標準のスタイルシートを読み込まない","enabled":"有効にする","preview":"プレビュー","undo_preview":"プレビューをundo","save":"保存","new":"新規","new_style":"新規スタイル","delete":"削除","delete_confirm":"このカスタマイズ設定を削除しますか?","about":"サイトカスタマイズ設定により、サイトのヘッダとスタイルシートを変更できます。設定を選択するか、編集を開始して新たな設定を追加してください。"},"email":{"title":"メール","settings":"設定","logs":"ログ","sent_at":"送信時間","user":"ユーザ","email_type":"メールタイプ","to_address":"送信先アドレス","test_email_address":"テスト用メールアドレス","send_test":"テストメール送信","sent_test":"送信完了!","delivery_method":"送信方法","preview_digest":"ダイジェストのプレビュー","preview_digest_desc":"フォーラムより送信されるダイジェストメールのプレビューです。","refresh":"更新","format":"フォーマット","html":"html","text":"text","last_seen_user":"ユーザが最後にサイトを訪れた日:","reply_key":"回答キー"},"logs":{"title":"ログ","action":"アクション","created_at":"作成","last_match_at":"最終マッチ","match_count":"マッチ","ip_address":"IP","screened_actions":{"block":"ブロック","do_nothing":"何もしない"},"staff_actions":{"title":"スタッフ操作","instructions":"ユーザ名やアクションをクリックするとリストをフィルタできます。アバターをクリックするとユーザページに遷移します。","clear_filters":"全てを表示する","staff_user":"スタッフユーザ","target_user":"対象ユーザ","subject":"対象","when":"いつ","context":"コンテンツ","details":"詳細","previous_value":"変更前","new_value":"変更後","diff":"差分を見る","show":"詳しく見る","modal_title":"詳細","no_previous":"変更前の値がありません。","deleted":"変更後の値がありません。レコードが削除されました。","actions":{"delete_user":"ユーザを削除","change_trust_level":"トラストレベルを変更","change_site_setting":"サイトの設定を変更","change_site_customization":"サイトのカスタマイズ設定を変更","delete_site_customization":"サイトのカスタマイズ設定を削除"}},"screened_emails":{"title":"ブロック対象アドレス","description":"新規アカウント作成時、次のメールアドレスからの登録をブロックする。","email":"メールアドレス"},"screened_urls":{"title":"ブロック対象 URL","description":"スパマーからのポストにおいて引用されていた URL のリスト。","url":"URL"}},"impersonate":{"title":"ユーザになりすます","username_or_email":"ユーザ名かメールアドレス","help":"デバッグ用途でユーザアカウントになりすますためのツールです。","not_found":"ユーザが見つかりませんでした。","invalid":"申し訳ありませんがこのユーザにはなりすませません。"},"users":{"title":"ユーザ","create":"管理者を追加","last_emailed":"最終メール","not_found":"このユーザネームはシステムに存在しません。","active":"アクティブ","nav":{"new":"新規","active":"アクティブ","pending":"保留中","admins":"管理者","moderators":"モデレータ","banned":"追放中","blocked":"ブロック中"},"approved":"承認?","approved_selected":{"one":"承認ユーザ","other":"承認ユーザ ({{count}})"},"reject_selected":{"one":"拒否ユーザ","other":"拒否ユーザ ({{count}})"},"titles":{"active":"アクティブユーザ","new":"新規ユーザ","pending":"保留中のユーザ","newuser":"トラストレベル0のユーザ (新規ユーザ)","basic":"トラストレベル1のユーザ (ベーシックユーザ)","regular":"トラストレベル2のユーザ (レギュラーユーザ)","leader":"トラストレベル3のユーザ (リーダ)","elder":"トラストレベル4のユーザ (マスター)","admins":"管理者ユーザ","moderators":"モデレータ","blocked":"ブロック中のユーザ","banned":"追放中のユーザ"},"reject_successful":{"one":"1人のユーザの拒否に成功しました。","other":"%{count}人のユーザの拒否に成功しました。"},"reject_failures":{"one":"1人のユーザの拒否に失敗しました。","other":"%{count}人のユーザの拒否に失敗しました。"}},"user":{"ban_failed":"ユーザ {{error}} の追放に失敗しました","unban_failed":"ユーザ {{error}} の追放解除に失敗しました","ban_duration":"ユーザを何日間追放しますか?","delete_all_posts":"全てのポストを削除","delete_all_posts_confirm":"%{posts}個のポストと%{topics}個のトピックが削除されます。よろしいですか?","ban":"追放","unban":"追放解除","banned":"追放中?","moderator":"モデレータ?","admin":"管理者?","blocked":"ブロック中?","show_admin_profile":"管理者","edit_title":"タイトルを編集","save_title":"タイトルを保存","refresh_browsers":"ブラウザを強制リフレッシュ","show_public_profile":"一般プロファイルを表示","impersonate":"このユーザになりすます","revoke_admin":"管理者権限を剥奪","grant_admin":"管理者権限を付与","revoke_moderation":"モデレータ権限を剥奪","grant_moderation":"モデレータ権限を付与","unblock":"ブロック解除","block":"ブロック","reputation":"レピュテーション","permissions":"パーミッション","activity":"アクティビティ","like_count":"「いいね！」された数","private_topics_count":"プライベートトピック数","posts_read_count":"読んだポスト数","post_count":"投稿したポスト数","topics_entered":"投稿したトピック数","flags_given_count":"設定したフラグ数","flags_received_count":"設定されたフラグ数","approve":"承認","approved_by":"承認したユーザ","approve_success":"ユーザが承認され、アクティベーション方法を記載したメールが送信されました。","approve_bulk_success":"成功! 選択したユーザ全員が承認され、メールが送信されました。","time_read":"リード時間","delete":"ユーザを削除","delete_forbidden":{"one":"登録後%{count}日以上が経過したユーザ、およびポスト投稿済のユーザは削除できません (ユーザ削除の前に全てのポストを削除してください)。","other":"登録後%{count}日以上が経過したユーザ、およびポスト投稿済のユーザは削除できません (ユーザ削除の前に全てのポストを削除してください)。"},"delete_confirm":"本当にこのユーザを削除しますか? この操作はやり直しできません!","delete_and_block":"\u003Cb\u003Eはい\u003C/b\u003E。さらにこのメールアドレスからのサインアップを以後\u003Cb\u003Eブロック\u003C/b\u003E","delete_dont_block":"\u003Cb\u003Eはい\u003C/b\u003E。ただしこのメールアドレスからのサインアップは\u003Cb\u003E許可\u003C/b\u003E","deleted":"ユーザが削除されました。","delete_failed":"ユーザ削除中にエラーが発生しました。このユーザの全てのポストを削除したことを確認してください。","send_activation_email":"アクティベーションメールを送信","activation_email_sent":"アクティベーションメールが送信されました。","send_activation_email_failed":"アクティベーションメールの送信に失敗しました。 %{error}","activate":"アカウントのアクティベート","activate_failed":"ユーザのアクティベートに失敗しました。","deactivate_account":"アカウントのアクティベート解除","deactivate_failed":"ユーザのアクティベート解除に失敗しました。","unblock_failed":"ユーザのブロック解除に失敗しました。","block_failed":"ユーザのブロックに失敗しました。","deactivate_explanation":"アクティベート解除されたユーザは、メールで再アクティベートする必要があります。","banned_explanation":"追放中のユーザはログインできません。","block_explanation":"ブロック中のユーザはポストの投稿およびトピックの作成ができません。","trust_level_change_failed":"ユーザのトラストレベル変更に失敗しました。"},"site_content":{"none":"編集するコンテンツのタイプを選択してください。","title":"コンテンツ","edit":"サイトのコンテンツを編集"},"site_settings":{"show_overriden":"上書き部分のみ表示","title":"設定","reset":"デフォルトに戻す","none":"なし"}}}}};
I18n.locale = 'ja';
// moment.js
// version : 2.0.0
// author : Tim Wood
// license : MIT
// momentjs.com

(function (undefined) {

    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = "2.0.0",
        round = Math.round, i,
        // internal storage for language config files
        languages = {},

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(\d*)?\.?(\d+)\:(\d+)\:(\d+)\.?(\d{3})?/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|SS?S?|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g,

        // parsing tokens
        parseMultipleFormatChunker = /([0-9a-zA-Z\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+)/gi,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/i, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO seperator)
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123

        // preliminary iso regex
        // 0000-00-00 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000
        isoRegex = /^\s*\d{4}-\d\d-\d\d((T| )(\d\d(:\d\d(:\d\d(\.\d\d?\d?)?)?)?)?([\+\-]\d\d:?\d\d)?)?/,
        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.S', /(T| )\d\d:\d\d:\d\d\.\d{1,3}/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker "+10:00" > ["10", "00"] or "-1530" > ["-15", "30"]
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            w : 'week',
            M : 'month',
            y : 'year'
        },

        // format function strings
        formatFunctions = {},

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.lang().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.lang().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.lang().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.lang().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.lang().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return this.weekYear();
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return this.isoWeekYear();
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return ~~(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(~~(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(~~(a / 60), 2) + ":" + leftZeroFill(~~a % 60, 2);
            },
            ZZ   : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(~~(10 * a / 6), 4);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            X    : function () {
                return this.unix();
            }
        };

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.lang().ordinal(func.call(this, a), period);
        };
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    /************************************
        Constructors
    ************************************/

    function Language() {

    }

    // Moment prototype object
    function Moment(config) {
        extend(this, config);
    }

    // Duration Constructor
    function Duration(duration) {
        var data = this._data = {},
            years = duration.years || duration.year || duration.y || 0,
            months = duration.months || duration.month || duration.M || 0,
            weeks = duration.weeks || duration.week || duration.w || 0,
            days = duration.days || duration.day || duration.d || 0,
            hours = duration.hours || duration.hour || duration.h || 0,
            minutes = duration.minutes || duration.minute || duration.m || 0,
            seconds = duration.seconds || duration.second || duration.s || 0,
            milliseconds = duration.milliseconds || duration.millisecond || duration.ms || 0;

        // representation for dateAddRemove
        this._milliseconds = milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = months +
            years * 12;

        // The following code bubbles up values, see the tests for
        // examples of what that means.
        data.milliseconds = milliseconds % 1000;
        seconds += absRound(milliseconds / 1000);

        data.seconds = seconds % 60;
        minutes += absRound(seconds / 60);

        data.minutes = minutes % 60;
        hours += absRound(minutes / 60);

        data.hours = hours % 24;
        days += absRound(hours / 24);

        days += weeks * 7;
        data.days = days % 30;

        months += absRound(days / 30);

        data.months = months % 12;
        years += absRound(months / 12);

        data.years = years;
    }


    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (b.hasOwnProperty(i)) {
                a[i] = b[i];
            }
        }
        return a;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength) {
        var output = number + '';
        while (output.length < targetLength) {
            output = '0' + output;
        }
        return output;
    }

    // helper function for _.addTime and _.subtractTime
    function addOrSubtractDurationFromMoment(mom, duration, isAdding, ignoreUpdateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months,
            minutes,
            hours,
            currentDate;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        // store the minutes and hours so we can restore them
        if (days || months) {
            minutes = mom.minute();
            hours = mom.hour();
        }
        if (days) {
            mom.date(mom.date() + days * isAdding);
        }
        if (months) {
            currentDate = mom.date();
            mom.date(1)
                .month(mom.month() + months * isAdding)
                .date(Math.min(currentDate, mom.daysInMonth()));
        }
        if (milliseconds && !ignoreUpdateOffset) {
            moment.updateOffset(mom);
        }
        // restore the minutes and hours after possibly changing dst
        if (days || months) {
            mom.minute(minutes);
            mom.hour(hours);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if (~~array1[i] !== ~~array2[i]) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        return units ? unitAliases[units] || units.toLowerCase().replace(/(.)s$/, '$1') : units;
    }


    /************************************
        Languages
    ************************************/


    Language.prototype = {
        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
        },

        _months : "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                if (!this._monthsParse[i]) {
                    mom = moment([2000, i]);
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LT : "h:mm A",
            L : "MM/DD/YYYY",
            LL : "MMMM D YYYY",
            LLL : "MMMM D YYYY LT",
            LLLL : "dddd, MMMM D YYYY LT"
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            return ((input + '').toLowerCase()[0] === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },

        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom) : output;
        },

        _relativeTime : {
            future : "in %s",
            past : "%s ago",
            s : "a few seconds",
            m : "a minute",
            mm : "%d minutes",
            h : "an hour",
            hh : "%d hours",
            d : "a day",
            dd : "%d days",
            M : "a month",
            MM : "%d months",
            y : "a year",
            yy : "%d years"
        },
        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },
        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace("%d", number);
        },
        _ordinal : "%d",

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },
        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        }
    };

    // Loads a language definition into the `languages` cache.  The function
    // takes a key and optionally values.  If not in the browser and no values
    // are provided, it will load the language file module.  As a convenience,
    // this function also returns the language values.
    function loadLang(key, values) {
        values.abbr = key;
        if (!languages[key]) {
            languages[key] = new Language();
        }
        languages[key].set(values);
        return languages[key];
    }

    // Determines which language definition to use and returns it.
    //
    // With no parameters, it will return the global language.  If you
    // pass in a language key, such as 'en', it will return the
    // definition for 'en', so long as 'en' has already been loaded using
    // moment.lang.
    function getLangDefinition(key) {
        if (!key) {
            return moment.fn._lang;
        }
        if (!languages[key] && hasModule) {
            require('./lang/' + key);
        }
        return languages[key];
    }


    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[.*\]/)) {
            return input.replace(/^\[|\]$/g, "");
        }
        return input.replace(/\\/g, "");
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = "";
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return m.lang().longDateFormat(input) || input;
        }

        while (i-- && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
        }

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        switch (token) {
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
            return parseTokenFourDigits;
        case 'YYYYY':
            return parseTokenSixDigits;
        case 'S':
        case 'SS':
        case 'SSS':
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return getLangDefinition(config._l)._meridiemParse;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
            return parseTokenOneOrTwoDigits;
        default :
            return new RegExp(token.replace('\\', ''));
        }
    }

    function timezoneMinutesFromString(string) {
        var tzchunk = (parseTokenTimezone.exec(string) || [])[0],
            parts = (tzchunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + ~~parts[2];

        return parts[0] === '+' ? -minutes : minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, b,
            datePartArray = config._a;

        switch (token) {
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            datePartArray[1] = (input == null) ? 0 : ~~input - 1;
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = getLangDefinition(config._l).monthsParse(input);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[1] = a;
            } else {
                config._isValid = false;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DDDD
        case 'DD' : // fall through to DDDD
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                datePartArray[2] = ~~input;
            }
            break;
        // YEAR
        case 'YY' :
            datePartArray[0] = ~~input + (~~input > 68 ? 1900 : 2000);
            break;
        case 'YYYY' :
        case 'YYYYY' :
            datePartArray[0] = ~~input;
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._isPm = getLangDefinition(config._l).isPM(input);
            break;
        // 24 HOUR
        case 'H' : // fall through to hh
        case 'HH' : // fall through to hh
        case 'h' : // fall through to hh
        case 'hh' :
            datePartArray[3] = ~~input;
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[4] = ~~input;
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[5] = ~~input;
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
            datePartArray[6] = ~~ (('0.' + input) * 1000);
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = timezoneMinutesFromString(input);
            break;
        }

        // if the input is null, the date is not valid
        if (input == null) {
            config._isValid = false;
        }
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromArray(config) {
        var i, date, input = [];

        if (config._d) {
            return;
        }

        for (i = 0; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        // add the offsets to the time to be parsed so that we can have a clean array for checking isValid
        input[3] += ~~((config._tzm || 0) / 60);
        input[4] += ~~((config._tzm || 0) % 60);

        date = new Date(0);

        if (config._useUTC) {
            date.setUTCFullYear(input[0], input[1], input[2]);
            date.setUTCHours(input[3], input[4], input[5], input[6]);
        } else {
            date.setFullYear(input[0], input[1], input[2]);
            date.setHours(input[3], input[4], input[5], input[6]);
        }

        config._d = date;
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {
        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var tokens = config._f.match(formattingTokens),
            string = config._i,
            i, parsedInput;

        config._a = [];

        for (i = 0; i < tokens.length; i++) {
            parsedInput = (getParseRegexForToken(tokens[i], config).exec(string) || [])[0];
            if (parsedInput) {
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
            }
            // don't parse if its not a known token
            if (formatTokenFunctions[tokens[i]]) {
                addTimeToArrayFromToken(tokens[i], parsedInput, config);
            }
        }

        // add remaining unparsed input to the string
        if (string) {
            config._il = string;
        }

        // handle am pm
        if (config._isPm && config._a[3] < 12) {
            config._a[3] += 12;
        }
        // if is 12 am, change hours to 0
        if (config._isPm === false && config._a[3] === 12) {
            config._a[3] = 0;
        }
        // return
        dateFromArray(config);
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            tempMoment,
            bestMoment,

            scoreToBeat = 99,
            i,
            currentScore;

        for (i = 0; i < config._f.length; i++) {
            tempConfig = extend({}, config);
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);
            tempMoment = new Moment(tempConfig);

            currentScore = compareArrays(tempConfig._a, tempMoment.toArray());

            // if there is any input that was not parsed
            // add a penalty for that format
            if (tempMoment._il) {
                currentScore += tempMoment._il.length;
            }

            if (currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempMoment;
            }
        }

        extend(config, bestMoment);
    }

    // date from iso format
    function makeDateFromString(config) {
        var i,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            // match[2] should be "T" or undefined
            config._f = 'YYYY-MM-DD' + (match[2] || " ");
            for (i = 0; i < 4; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (parseTokenTimezone.exec(string)) {
                config._f += " Z";
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._d = new Date(string);
        }
    }

    function makeDateFromInput(config) {
        var input = config._i,
            matched = aspNetJsonRegex.exec(input);

        if (input === undefined) {
            config._d = new Date();
        } else if (matched) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = input.slice(0);
            dateFromArray(config);
        } else {
            config._d = input instanceof Date ? new Date(+input) : new Date(input);
        }
    }


    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, lang) {
        return lang.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(milliseconds, withoutSuffix, lang) {
        var seconds = round(Math.abs(milliseconds) / 1000),
            minutes = round(seconds / 60),
            hours = round(minutes / 60),
            days = round(hours / 24),
            years = round(days / 365),
            args = seconds < 45 && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < 45 && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < 22 && ['hh', hours] ||
                days === 1 && ['d'] ||
                days <= 25 && ['dd', days] ||
                days <= 45 && ['M'] ||
                days < 345 && ['MM', round(days / 30)] ||
                years === 1 && ['y'] || ['yy', years];
        args[2] = withoutSuffix;
        args[3] = milliseconds > 0;
        args[4] = lang;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add('d', daysToDayOfWeek);
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }


    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f;

        if (input === null || input === '') {
            return null;
        }

        if (typeof input === 'string') {
            config._i = input = getLangDefinition().preparse(input);
        }

        if (moment.isMoment(input)) {
            config = extend({}, input);
            config._d = new Date(+input._d);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        return new Moment(config);
    }

    moment = function (input, format, lang) {
        return makeMoment({
            _i : input,
            _f : format,
            _l : lang,
            _isUTC : false
        });
    };

    // creating with utc
    moment.utc = function (input, format, lang) {
        return makeMoment({
            _useUTC : true,
            _isUTC : true,
            _l : lang,
            _i : input,
            _f : format
        });
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var isDuration = moment.isDuration(input),
            isNumber = (typeof input === 'number'),
            duration = (isDuration ? input._data : (isNumber ? {} : input)),
            matched = aspNetTimeSpanJsonRegex.exec(input),
            sign,
            ret;

        if (isNumber) {
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (matched) {
            sign = (matched[1] === "-") ? -1 : 1;
            duration = {
                y: 0,
                d: ~~matched[2] * sign,
                h: ~~matched[3] * sign,
                m: ~~matched[4] * sign,
                s: ~~matched[5] * sign,
                ms: ~~matched[6] * sign
            };
        }

        ret = new Duration(duration);

        if (isDuration && input.hasOwnProperty('_lang')) {
            ret._lang = input._lang;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function will load languages and then set the global language.  If
    // no arguments are passed in, it will simply return the current global
    // language key.
    moment.lang = function (key, values) {
        var i;

        if (!key) {
            return moment.fn._lang._abbr;
        }
        if (values) {
            loadLang(key, values);
        } else if (!languages[key]) {
            getLangDefinition(key);
        }
        moment.duration.fn._lang = moment.fn._lang = getLangDefinition(key);
    };

    // returns language data
    moment.langData = function (key) {
        if (key && key._lang && key._lang._abbr) {
            key = key._lang._abbr;
        }
        return getLangDefinition(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment;
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };


    /************************************
        Moment Prototype
    ************************************/


    moment.fn = Moment.prototype = {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d + ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            return formatMoment(moment(this).utc(), 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            if (this._isValid == null) {
                if (this._a) {
                    this._isValid = !compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray());
                } else {
                    this._isValid = !isNaN(this._d.getTime());
                }
            }
            return !!this._isValid;
        },

        utc : function () {
            return this.zone(0);
        },

        local : function () {
            this.zone(0);
            this._isUTC = false;
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.lang().postformat(output);
        },

        add : function (input, val) {
            var dur;
            // switch args to support add('s', 1) and add(1, 's')
            if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, 1);
            return this;
        },

        subtract : function (input, val) {
            var dur;
            // switch args to support subtract('s', 1) and subtract(1, 's')
            if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, -1);
            return this;
        },

        diff : function (input, units, asFloat) {
            var that = this._isUTC ? moment(input).zone(this._offset || 0) : moment(input).local(),
                zoneDiff = (this.zone() - that.zone()) * 6e4,
                diff, output;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month') {
                diff = (this.daysInMonth() + that.daysInMonth()) * 432e5; // 24 * 60 * 60 * 1000 / 2
                output = ((this.year() - that.year()) * 12) + (this.month() - that.month());
                output += ((this - moment(this).startOf('month')) - (that - moment(that).startOf('month'))) / diff;
                if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = (this - that) - zoneDiff;
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? diff / 864e5 : // 1000 * 60 * 60 * 24
                    units === 'week' ? diff / 6048e5 : // 1000 * 60 * 60 * 24 * 7
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration(this.diff(time)).lang(this.lang()._abbr).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function () {
            var diff = this.diff(moment().startOf('day'), 'days', true),
                format = diff < -6 ? 'sameElse' :
                diff < -1 ? 'lastWeek' :
                diff < 0 ? 'lastDay' :
                diff < 1 ? 'sameDay' :
                diff < 2 ? 'nextDay' :
                diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.lang().calendar(format, this));
        },

        isLeapYear : function () {
            var year = this.year();
            return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        },

        isDST : function () {
            return (this.zone() < this.clone().month(0).zone() ||
                this.zone() < this.clone().month(5).zone());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                if (typeof input === 'string') {
                    input = this.lang().weekdaysParse(input);
                    if (typeof input !== 'number') {
                        return this;
                    }
                }
                return this.add({ d : input - day });
            } else {
                return day;
            }
        },

        month : function (input) {
            var utc = this._isUTC ? 'UTC' : '';
            if (input != null) {
                if (typeof input === 'string') {
                    input = this.lang().monthsParse(input);
                    if (typeof input !== 'number') {
                        return this;
                    }
                }
                this._d['set' + utc + 'Month'](input);
                moment.updateOffset(this);
                return this;
            } else {
                return this._d['get' + utc + 'Month']();
            }
        },

        startOf: function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            }

            return this;
        },

        endOf: function (units) {
            return this.startOf(units).add(units, 1).subtract('ms', 1);
        },

        isAfter: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) > +moment(input).startOf(units);
        },

        isBefore: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) < +moment(input).startOf(units);
        },

        isSame: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) === +moment(input).startOf(units);
        },

        min: function (other) {
            other = moment.apply(null, arguments);
            return other < this ? this : other;
        },

        max: function (other) {
            other = moment.apply(null, arguments);
            return other > this ? this : other;
        },

        zone : function (input) {
            var offset = this._offset || 0;
            if (input != null) {
                if (typeof input === "string") {
                    input = timezoneMinutesFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                this._offset = input;
                this._isUTC = true;
                if (offset !== input) {
                    addOrSubtractDurationFromMoment(this, moment.duration(offset - input, 'm'), 1, true);
                }
            } else {
                return this._isUTC ? offset : this._d.getTimezoneOffset();
            }
            return this;
        },

        zoneAbbr : function () {
            return this._isUTC ? "UTC" : "";
        },

        zoneName : function () {
            return this._isUTC ? "Coordinated Universal Time" : "";
        },

        daysInMonth : function () {
            return moment.utc([this.year(), this.month() + 1, 0]).date();
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add("d", (input - dayOfYear));
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.lang()._week.dow, this.lang()._week.doy).year;
            return input == null ? year : this.add("y", (input - year));
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add("y", (input - year));
        },

        week : function (input) {
            var week = this.lang().week(this);
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        weekday : function (input) {
            var weekday = (this._d.getDay() + 7 - this.lang()._week.dow) % 7;
            return input == null ? weekday : this.add("d", input - weekday);
        },

        isoWeekday : function (input) {
            // iso weeks start on monday, which is 1, so we subtract 1 (and add
            // 7 for negative mod to work).
            var weekday = (this._d.getDay() + 6) % 7;
            return input == null ? weekday : this.add("d", input - weekday);
        },

        // If passed a language key, it will set the language for this
        // instance.  Otherwise, it will return the language configuration
        // variables for this instance.
        lang : function (key) {
            if (key === undefined) {
                return this._lang;
            } else {
                this._lang = getLangDefinition(key);
                return this;
            }
        }
    };

    // helper for adding shortcuts
    function makeGetterAndSetter(name, key) {
        moment.fn[name] = moment.fn[name + 's'] = function (input) {
            var utc = this._isUTC ? 'UTC' : '';
            if (input != null) {
                this._d['set' + utc + key](input);
                moment.updateOffset(this);
                return this;
            } else {
                return this._d['get' + utc + key]();
            }
        };
    }

    // loop through and add shortcuts (Month, Date, Hours, Minutes, Seconds, Milliseconds)
    for (i = 0; i < proxyGettersAndSetters.length; i ++) {
        makeGetterAndSetter(proxyGettersAndSetters[i].toLowerCase().replace(/s$/, ''), proxyGettersAndSetters[i]);
    }

    // add shortcut for year (uses different syntax than the getter/setter 'year' == 'FullYear')
    makeGetterAndSetter('year', 'FullYear');

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    /************************************
        Duration Prototype
    ************************************/


    moment.duration.fn = Duration.prototype = {
        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              ~~(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var difference = +this,
                output = relativeTime(difference, !withSuffix, this.lang());

            if (withSuffix) {
                output = this.lang().pastFuture(difference, output);
            }

            return this.lang().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            units = normalizeUnits(units);
            return this['as' + units.charAt(0).toUpperCase() + units.slice(1) + 's']();
        },

        lang : moment.fn.lang
    };

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    function makeDurationAsGetter(name, factor) {
        moment.duration.fn['as' + name] = function () {
            return +this / factor;
        };
    }

    for (i in unitMillisecondFactors) {
        if (unitMillisecondFactors.hasOwnProperty(i)) {
            makeDurationAsGetter(i, unitMillisecondFactors[i]);
            makeDurationGetter(i.toLowerCase());
        }
    }

    makeDurationAsGetter('Weeks', 6048e5);
    moment.duration.fn.asMonths = function () {
        return (+this - this.years() * 31536e6) / 2592e6 + this.years() * 12;
    };


    /************************************
        Default Lang
    ************************************/


    // Set default language, other languages will inherit from English.
    moment.lang('en', {
        ordinal : function (number) {
            var b = number % 10,
                output = (~~ (number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });


    /************************************
        Exposing Moment
    ************************************/


    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    }
    /*global ender:false */
    if (typeof ender === 'undefined') {
        // here, `this` means `window` in the browser, or `global` on the server
        // add `moment` as a global object via a string identifier,
        // for Closure Compiler "advanced" mode
        this['moment'] = moment;
    }
    /*global define:false */
    if (typeof define === "function" && define.amd) {
        define("moment", [], function () {
            return moment;
        });
    }
}).call(this);
moment.fn.shortDateNoYear = function(){ return this.format('D MMM'); };
moment.fn.shortDate = function(){ return this.format('D MMM, YYYY'); };
moment.fn.longDate = function(){ return this.format('MMMM D, YYYY h:mma'); };
moment.fn.relativeAge = function(opts){ return Discourse.Formatter.relativeAge(this.toDate(), opts)};
