
function Clamp(val, vmin, vmax) {
	if(val <= vmin)
		return vmin;
	if(val >= vmax)
		return vmax;
	return val;
}

// イメージのロードが終わるまでポーリングして待つ
// wait for loading image (polling)
function WaitForLoad(img, intv, cf) {
	var i_id = window.setInterval(function(){
		var w = parseInt(img.css("width")),
			h = parseInt(img.css("height"));
		if(w>0 && h>0) {
			cf(img, w, h);
			window.clearInterval(i_id);
		}	
	}, intv);
}
// イメージのロードが終わったらparentObjの中央に配置する
// wait for loading image (polling) and centering
function WaitForLoadCentering(img, intv, parentObj, cf) {
	WaitForLoad(img, intv, function(img, w, h) {
		var posx = parseInt(parentObj.css("width"))/2 - w/2,
			posy = parseInt(parentObj.css("height"))/2 - h/2;
		img.css({
			position: "absolute",
			left: posx + "px",
			top: posy + "px"
		});
		if(cf !== undefined)
			cf();
	});			
}

/// ScreenShot Gallery
/**
 * -------- FIELDS --------
 * baseDOM (insertion target) [jQ]
 * dom (DOM layout of ScGallery) [jQ]
 * basePath (image folder's root path) [string]
 * docDir (PHP program directory for file enumeration) [string]
 * groups (folder / file list) [table]
 * item [table]
 *	dbox (detail box) [jQ]
 *	pic (picture box) [jQ]
 *	sel (thumbnail selector) [jQ]
 *	tbar (thumbnails window) [jQ]
 *	loading (image loadingIcon) [jQ]
 * 	loading_rect (thumbnail loadingIcon) [jQ]
 *	ttitle (thumbnail group title) [jQ]
 *	caption (image caption) [jQ]
 *	comment (image comment) [jQ]
 * 	capdiv (caption window) [jQ]
 *	dummy (hidden space for loading image) [jQ]
 *
 * capCounter (caption remaining time) [number]
 * bDeclCap (decrease capCounter or not) [bool]
 * active (current active objects) [table]
 * 	name (groupname) [string]
 * 	id (image index) [number]
 * 	thumb (thumbnail box object) [jQ]
 * 
 * constructor()
 * @param basePath[in]	screenshot path
 * @param baseDOM[in]	DOMElement to insert the viewer
 */
const INITFLAG_GROUP = 0x01;
const INITFLAG_COMPONENT = 0x02;
function ScGallery(phpPath, groupPath, baseDOM) {
	// ファイルリストとDOMレイアウトをクエリ
	// query file list and DOM layout
	$.get(phpPath, {folder: groupPath}, _recvG);
	$.get("./component.html", {}, _recvCP);
	
	this.docPath = phpPath;
	var path = phpPath.match(/(.+)(?:\/\w+\.php)/i);
	this.docDir = path[1];
    
	var self = this;
	this.baseDOM = baseDOM;
	this.groupPath = groupPath;
	this.capCounter = 0;
	this.bDeclCap = true;
	
	this.active = {
		name: null,
		id: -1,
		thumb: null
	}

	var initflag = 0x03;
	function _recvG(data, status) {
		// ファイル/グループリストを受け取る
		// receive file /folder list
		eval("var dat=" + data);
		self.groups = dat;
		self.basePath = self.docDir + "/" + self.groupPath;
		_checkInitFlag(INITFLAG_GROUP);
	}
	function _recvCP(data, status) {
		// DOMレイアウトを受け取る
		// recieve DOM layout
		self.dom = $(data);
		_checkInitFlag(INITFLAG_COMPONENT);
	}
	function _checkInitFlag(flag) {
		// ファイルリストとDOMレイアウトの初期化が終わったら本体の初期化をする
		// initialize class value when both (_recvG and _recvCP) is completed
		initflag &= ~flag;
		if(initflag === 0)
			_init();
	}
    
    /// コメントウィンドウを出す slideup comment window (for while)
    /**
     * @param[in] duration(second)
     * */
    function _showCaption(duration) {
	var prev = self.capCounter;
	var cd = self.item.capdiv;
	self.capCounter = duration;
	
	if(prev <= 0 && duration > 0) {
		cd.fadeIn("fast");
		var id = window.setInterval(function() {
			if(--self.capCounter <= 0 && self.bDeclCap) {
				cd.fadeOut("fast");
				window.clearInterval(id);
			}
		}, 1000);
	}
    }
    /// コメント表示残り時間の減算をオンオフ switch comment window remaining time decreasing
    function _enableCapCounter(bDecl) {
	self.bDeclCap = bDecl;
	var cd = self.item.capdiv;
	if(!bDecl)
		cd.fadeIn("fast");
	else if(self.capCounter <= 0)
		cd.fadeOut("fast");
    }
	
    /// ディティールウィンドウに出すローディングアイコンを初期化 initialize Large-LoadingIcon for detail-window
    function _initLoadingIcon() {
	var img = $("<img>", {"src": "loading.gif"});
	var divLoad = self.item.loading
				.append(img)
				.fadeOut(0);
	var db = self.item.dbox;
	// 読み込みが終わったらparentObj領域の中央にオブジェクトを配置
	// place "LoadingIcon" at center when image object ready
	WaitForLoadCentering(img, 10, divLoad, function(){
		var posx = parseInt(db.css("width"))/2 - parseInt(divLoad.css("width"))/2,
			posy = parseInt(db.css("height"))/2 - parseInt(divLoad.css("height"))/2;
		divLoad.css("left", posx+"px")
				.css("top", posy+"px");
	});
    }

    /// サムネイル枠と、中心で回るくるくる画像 initialize Small-LoadingIcon for thumbnail
    function _initLoadingRect() {
	var img = $("<img>", {
		"src": "loading_s.gif",
		 "class": "slc_Loading_s"
	});
	var divLS = $("<div>", {
		"class": "slc_ThumbBoxH",
		"alt": "thumb"
	});
	self.item.loading_rect = divLS.append(img);
	divLS.fadeTo(0,0).appendTo(self.item.dummy);
	WaitForLoadCentering(img, 10, divLS);
    }
	
    /// グループセレクタを用意 initialize group selector
    function _initGroupList() {
	var sel = self.dom.find(".slc_GroupSel > select");
	sel.append($("<option>", {text: "--- select group ---"}));
	for(var i in self.groups) {
		var g = self.groups[i];
		sel.append($("<option>", {text: i}));
	}
    }
    
    function _init() {
	// レイアウト追加
	// append DOM-layout to target
	var dom = self.baseDOM;
	dom.append(self.dom);

	// よく使うオブジェクトをストック stock frequency used elements
	self.item = {
		dbox: dom.find(".slc_DetailBox"),
		pic: dom.find(".slc_PictureBox"),
		sel: dom.find(".slc_ThumbSel"),
		tbar: dom.find(".slc_Thumbnail"),
		ttitle: dom.find(".slc_GroupTitle>div"),
		loading: dom.find(".slc_Loading"),
		caption: dom.find(".slc_Title"),
		comment: dom.find(".slc_Comment"),
		capdiv: dom.find(".slc_Caption"),
		dummy: dom.find(".slc_DummySpace")
	};
	
	// カーソルがピクチャボックスに入ったらキャプションと操作ボタンを表示
	// setup events
	dom.find(".slc_Overlay").hide();
	dom.find(".slc_DetailBox")
		.mouseenter(function(){
			_enableCapCounter(false);
			var ov = $(this).find(".slc_Overlay");
			ov.stop(true,true).fadeIn("fast");
		})
		.mouseleave(function(){
			_enableCapCounter(true);
			var ov = $(this).find(".slc_Overlay");
			ov.stop(true,true).fadeOut("fast");
		});
	// カーソルが操作ボタンに乗ったら透明度を下げる
	// when cursor overlapping, show control buttons
	dom.find(".slc_DetailBox .slc_Ctrl *")
		.each(function(){
		var ths = $(this);
		ths.css("opacity", "0.1")
		.mouseenter(function(){
			ths.stop(true,true).fadeTo("fast", 1);
		})
		.mouseleave(function(){
			ths.stop(true,true).fadeTo("fast", 0.1);
		});
	});
	// 「前へ」
	// previous picture
	dom.find(".slc_Prev").click(function(){
		if(self.active.id > 0)
			show("relative", -1);
	});
	// 「次へ」
	// next picture
	dom.find(".slc_Next").click(function(){
		show("relative", 1);
	});
	// サムネイルグループが切り替えられたら次のを読み込む
	// when thumbnail group changed, load next group
	dom.find(".slc_GroupSel>select").change(function(e){
		var v = e.target;
		var op = v.options[v.selectedIndex];
		_refreshThumbWindow(op.value);
	});
	
	self.item.capdiv.fadeOut(0);
	_initLoadingIcon();
	_initLoadingRect();
	_initGroupList();
    }
    function _makePath(imageName) {
	return self.basePath + "/" + self.active.name + "/" + imageName;
    }

    /// サムネイル欄を更新 refresh thumbnails
    function _refreshThumbWindow(groupName) {
	var tbar = self.item.tbar
	var ttitle = self.item.ttitle
	var sel = self.item.sel
	var ttext = ""
	// 一度バーをたたんで、読み込み予約してから広げる
	// slideup thumbnail window and queueing next thumbnail group
	tbar.slideUp("fast", function() {
		sel.hide();
		tbar.children(".slc_ThumbBox").remove();

		if(groupName in self.groups) {
			self.active.name = groupName;
			// Filesエントリに格納されたファイル名リストに大してクエリを送る
			// query thumbnail image files in "files" entry
			var g = self.groups[groupName];
			var files = g.files;
			for(var i=0 ; i<files.length ; i++) {
				(function() {
					var ai = i;
					var fInfo = files[ai];
					var imageName = ("thumb" in fInfo) ? fInfo.thumb : fInfo.image;
					var p = _makePath(imageName);
					var img = $("<img>", {
						"src": p,
						"alt": "thumb",
						"class": "slc_ThumbBox"
					});
					var c_eve = function() {
						self.active.thumb = img;
						_refreshPic(ai);
					};
					img.fadeTo(0,0);
					self.item.dummy.append(img);
					
					// まずはプレースホルダを配置
					// prepare place-holder
					var p_holder = self.item.loading_rect.clone();
					p_holder.fadeTo(0,1).appendTo(tbar);
					WaitForLoad(img, 100, function(img, w, h) {
						// サムネイルプレースホルダと差し替え
						// クリックイベントも設定
						// swap place-holder and thumbnail image
						// setup event(click)
						img.detach().click(c_eve).fadeTo(500,1);
						p_holder.fadeTo("fast", 0, function() {
							// プレースホルダは役目を終えました
							// remove place-holder
							p_holder.replaceWith(img)
									.remove();
						});
					});
				})();
			}
			
			// 無選択状態にする
			// set as no thumbnail is selected
			_refreshPic(-1);
			
			ttext = g.title.length>0 ? g.title : groupName;
		}
		// サムネイルタイトルを反映 apply thumbnail group title
		ttitle.fadeTo(0, 0).text(ttext).fadeTo("slow", 1);			
		tbar.slideDown("fast", function() {});
	});
    }
	/// 詳細画像の更新 refresh picture
	function _refreshPic(imageIdx) {
		var gname = self.active.name;
		var pic = self.item.pic;
		// 負数は非表示を意味する
		// negative value means to hide image
		if(gname === null || imageIdx < 0) {
			pic.fadeTo("fast", 0);
			self.active.id = -1;
			self.active.thumb = null;
		} else {
			var g = self.groups[gname];
			imageIdx = Clamp(imageIdx, 0, g.length-1);
			if(imageIdx != self.active.id) {
				self.active.id = imageIdx;
				self.active.thumb = self.item.tbar.find(".slc_ThumbBox").eq(imageIdx);
				_adjSelector();
				
				var loading = self.item.loading;
				loading.stop(true,true).fadeIn("normal");
				// 一旦フェードアウトさせる
				// fadeout current image first
				pic.stop(true,true).fadeTo("fast", 0, function() {
					// イメージの差し替えと中央寄せ
					// swap image source and centering
					var fInfo = g.files[imageIdx];
					pic.attr("src", "")
						.attr("src", _makePath(fInfo.image));
	
					WaitForLoadCentering(pic, 100, self.item.dbox, function() {
						loading.fadeOut("normal");
						// フェードイン
						// fadein next image
						pic.fadeTo("fast", 1);
					});
	
					// コメントを設定
					// set image's comment (if available)
					_setComment(fInfo.caption, fInfo.comment);
				});
			}
		}
		_adjSelector();
	}
	/// 画像コメントの更新 set the comment attached to current image
	function _setComment(caption, comment) {
		var bCp = typeof(caption) === "string",
			bCm = typeof(comment) === "string";
		
		self.item.caption.text(bCp ? caption : "");
		self.item.comment.text(bCm ? comment : "");
		_showCaption((bCp || bCm) ? 3 : 0);
	}
	/// サムネイルセレクタ枠の移動 move thumbnail selector
	function _adjSelector() {
		var sel = self.item.sel;
		if(self.active.id < 0) {
			sel.fadeOut("fast");
		} else {
			sel.fadeIn("fast");
			var thumb = self.active.thumb;
			sel.animate({
					"left": ""+(thumb.get()[0].offsetLeft - 4) + "px",
					"top": ""+(thumb.get()[0].offsetTop - 2) + "px",
				}, {
					"duration": 100,
					"easing": "swing",
					"queue": false
			});
		}
	}
	/// 表示する画像の変更 change detail image to show
	/** 現在のサムネイルグループからしか選択できない
	 * this can choose image from current thumbnail group
	 * 
	 * @param mvtype[string] インデックス指定タイプ "relative"=相対, "absolute"=絶対 <br>
	 * index type
	 * @param idx[number] インデックス <br>
	 * index number (from current thumbnail group)
	 */
	function show(mvtype, idx) {
		var act = self.active;
		if(mvtype === "relative") {
			idx += act.id;
		} else if(mvtype === "absolute") {}
		_refreshPic(idx);
	}
}

ScGallery.prototype = {}
