<?php
	/* 指定フォルダの内容を画像ファイルに絞って列挙したリストをJSON形式で返す
	   引数は group: "検索対象パス"
	   
	   enumerate image files(has bmp|png|jpg|jpeg|gif format) and groups(folder) and return as JSON

	example:
	   BASEPATH = '/gallery'
	   http://(host)/getgroup.php?folder=gallery
	   
	   output
		{
			"mygame": {
				"title": "mygame's screenshot",
				"files": [
					{
						"image": "title.jpg",
						"thumb": "title_low.jpg",
						"caption": "title screen",
						"comment": "still in progress..."
					},
					{
						"image": "leaderboard.jpg",
						"thumb": "leaderboard_low.jpg",
						"caption": "the leaderboard",
						"comment": "you can check your rank"
					}
				]
			},
			"photo": {
				"title": "photo of my travel",
				"files": {
					{
						"image": "mt_fuji.jpg",
						"thumb": "mt_fuji_low.jpg",
						"caption": "Mount Fuji",
						"comment": "highest mountain in Japan located on Honshu Island"
					}
				}
			}
		}
		
	    comment file:
	    (in /gallery/mygame/caption.json)
	    {
	    	"title": "mygame's screenshot",
	    	"title.jpg": ["title screen", "still in pregress..."],
	    	"leaderboard.jpg": ["the leaderboard", "you can check your rank"]
	    }
	    
	    (in /gallery/photo/caption.json)
	    {
	    	"title": "photo of my travel",
	    	"mt_fuji.jpg": ["Mount Fuji", "highest mountain in Japan located on Honshu Island"]
	    }
	*/
	// ベースパス以下のパスが検索対象
	// this program allows to scan the path under BASEPATH
	define('BASEPATH', './');
	
	$EXT_ARRAY = array('bmp', 'png', 'jpg', 'jpeg', 'gif');
	// 拡張子が$EXT_ARRAYにある物を抽出する正規化構文を用意
	// prepare regex pattern for checking filename witch has extension of image
	$ext_str = "";
	foreach($EXT_ARRAY as $ext)
		$ext_str = $ext_str . '(?:' . $ext . ')|';
	$ext_str = substr($ext_str, 0, strlen($ext_str)-1);
	$ext_str = $ext_str . ")@i";
	
	$ext_strFileLOW = "@\w+_low\.(" . $ext_str;
	$ext_strFile = "@\w+\.(" . $ext_str;
	
	// ドットファイル、拡張子ありファイルを除外する正規化構文
	// prepare regex pattern for detecting folder 
	$ext_strFolder = "@([^\.]+)@";
	
	// 画像ファイル名_low.jpgがサムネイル画像
	// 'image-filename'_low.jpg means the thumbnail filename
	
	// 再帰的にフォルダ構造を解析
	// (現在は1階層のみ対応)
	// scan folder tree recursively
	// (but support only one-layer at this version)
	function GetInfo($path, $depth, $json) {
		global $EXT_ARRAY;
		global $ext_strFile, $ext_strFileLOW, $ext_strFolder;
		
		$result = array();
		$ar = scandir($path);
		if($depth == 0) {			
			$title = "";
			if(!is_null($json))
				$title = $json['title'];
			$result['title'] = $title;
			
			$files = array();		
			foreach($ar as $fname) {
				if(preg_match($ext_strFile, $fname, $match)) {
					if(strlen($fname) === strlen($match[0])) {
						// サムネイル画像は無視
						// skip thumbnail images
						if(preg_match($ext_strFileLOW, $fname, $match) != 0)
							continue;

						$ftbl = array();
						
						$ftbl['image'] = $fname;
						// サムネイル画像を検索
						// output thumbnail image path when available (if not, full-size image be used)
						$pattern = array();
						$pattern[0] = '/\./';
						
						$replace = array();
						$replace[0] = '_low.';
						$lowfname = preg_replace($pattern, $replace, $fname);
						$lowfpath = $path . '/' . $lowfname;
						if(file_exists($lowfpath))
							$ftbl['thumb'] = $lowfname;
						// コメントが設定されていれば出力
						// output comments if caption.json is available and has entry
						if(!is_null($json) && isset($json[$fname])) {
							$jf = $json[$fname];

							$ftbl['caption'] = $jf[0];
							$ftbl['comment'] = $jf[1];
						}
						$files[] = $ftbl;
					}
				}
			}
			$result['files'] = $files;
		} else {
			foreach($ar as $fname) {
				if(preg_match($ext_strFolder, $fname, $match)) {
					if(strlen($fname) === strlen($match[0])) {
						$nextPath = $path . '/' . $fname;
						
						// もしJSONファイルがあったら読み込んで次の関数へ渡す
						// load comment JSON file and pass into deeper function (if available)
						$jpath = $nextPath . '/caption.json';
						$json = null;
						if(file_exists($jpath)) {
							$fp = fopen($jpath, "rb");
							$json = fread($fp, filesize($jpath));
							fclose($fp);
							$json = json_decode($json, true);
						}
	
						$result[$fname] = GetInfo($nextPath, $depth-1, $json);
					}
				}
			}
		}
		
		return $result;
	}
	
	// $cmpが$pathの先頭にあるか？
	// is $cmp at the first-place of $path ?
	function HasPath($path, $cmp) {
		return strlen(stristr($path, $cmp)) == strlen($path);
	}

	if(isset($_GET["folder"])) {
		$result = array();
		
		// セキュリティの為、ベースパス以下かチェック
		// check requested path is under BASEPATH (for security)
		$path = './' . $_GET['folder'];
		if(HasPath($path, BASEPATH)) {
			chdir(dirname(__FILE__));
			
			// ファイルを列挙してJSONフォーマットで返す
			// enumerate image files and return as JSON
			$resF = GetInfo($path, 1);
			echo json_encode($resF);
		}
	}

?>

