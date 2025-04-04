
;(function(window) {

	'use strict';

	// 音乐库全局变量
	var musicLibrary = null;

	// 加载音乐库数据
	function loadMusicLibrary(callback) {
		var request = new XMLHttpRequest();
		request.open('GET', 'music/music-library.json', true);
		request.onload = function() {
			if (this.status >= 200 && this.status < 400) {
				try {
					musicLibrary = JSON.parse(this.response);
					if (callback) callback(null, musicLibrary);
				} catch (err) {
					if (callback) callback(err);
				}
			} else {
				if (callback) callback(new Error('Failed to load music library'));
			}
		};
		request.onerror = function() {
			if (callback) callback(new Error('Failed to load music library'));
		};
		request.send();
	}

	// 根据专辑ID获取专辑信息
	function getAlbumById(albumId) {
		if (!musicLibrary) return null;
		return musicLibrary.albums.find(function(album) {
			return album.id === albumId;
		});
	}

	// Helper vars and functions.
	function extend( a, b ) {
		for( var key in b ) { 
			if( b.hasOwnProperty( key ) ) {
				a[key] = b[key];
			}
		}
		return a;
	}
	function objsize(obj) {
		var size = 0;
		for (var key in obj) {
			if (obj.hasOwnProperty(key)){
				size++;
			}
		}
		return size;
	};
	// From https://davidwalsh.name/javascript-debounce-function.
	function debounce(func, wait, immediate) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			var later = function() {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	};
	// From http://stackoverflow.com/a/12221389.
	function circleIntersection(x0, y0, r0, x1, y1, r1) {
		var a, dx, dy, d, h, rx, ry;
		var x2, y2;

		/* dx and dy are the vertical and horizontal distances between
		 * the circle centers.
		 */
		dx = x1 - x0;
		dy = y1 - y0;

		/* Determine the straight-line distance between the centers. */
		d = Math.sqrt((dy*dy) + (dx*dx));

		/* Check for solvability. */
		if (d > (r0 + r1)) {
			/* no solution. circles do not intersect. */
			return false;
		}
		if (d < Math.abs(r0 - r1)) {
			/* no solution. one circle is contained in the other */
			return false;
		}

		/* 'point 2' is the point where the line through the circle
		 * intersection points crosses the line between the circle
		 * centers.  
		 */

		/* Determine the distance from point 0 to point 2. */
		a = ((r0*r0) - (r1*r1) + (d*d)) / (2.0 * d) ;

		/* Determine the coordinates of point 2. */
		x2 = x0 + (dx * a/d);
		y2 = y0 + (dy * a/d);

		/* Determine the distance from point 2 to either of the
		 * intersection points.
		 */
		h = Math.sqrt((r0*r0) - (a*a));

		/* Now determine the offsets of the intersection points from
		 * point 2.
		 */
		rx = -dy * (h/d);
		ry = dx * (h/d);

		/* Determine the absolute intersection points. */
		var xi = x2 + rx;
		var xi_prime = x2 - rx;
		var yi = y2 + ry;
		var yi_prime = y2 - ry;

		//return [xi, xi_prime, yi, yi_prime];
		return {
			x : xi,
			y : yi
		};
	};

	var winsize = {width : window.innerWidth, height : window.innerHeight};

	/**
	 * Turntable obj.
	 */
	function Turntable(el, options) {
		// Player HTML elem.
		this.el = el;

		// Audio Context.
		this.audioCtx = new AudioContext();

		// Options/Settings.
		this.options = extend( {}, this.options );
		extend( this.options, options );

		// Current noise value (the turntable scratch effect).
		this.noiseVal = 0; // 默认设置为0，关闭常规噪音效果
		// Delay (in seconds) for the buffer to start (min:1).
		this.bufferDelay = 2;
		// Current arm rotation.
		this.armRotation = 0;
		// Audio context destination / output.
		this.speakers = this.audioCtx.destination;
		// Room effect idx (for the web audio convolver). 
		// All the effects available should be in the options.effectBuffers array.
		this.effect = -1; // None by default.
		// Create convolver for the room effects.
		this.convolver = this.audioCtx.createConvolver();
		
		// UI stuff.
		this.ui = {
			player : this.el.querySelector('.player__element--lp'),
			recordCover : this.el.querySelector('.player__svg-lp > path#cover'),
			arm : this.el.querySelector('.player__element--tonearm > svg'),
			visualizer : this.el.querySelector('.player-stand > .visualizer'),
			tracklist : this.el.querySelector('.player-tracklist > .tracklist-items')
		};
		// Controls
		this.ctrls = {
			// 返回按钮可能已移除，但播放视图中可能还有
			back : this.el.querySelector('.control-button--back'),
			play : this.el.querySelector('.player__controls > button.player-button--playstop'),
			playStatus : this.el.querySelector('.player__controls > button.player-button--playstop .icon--play'),
			stopStatus : this.el.querySelector('.player__controls > button.player-button--playstop .icon--stop'),
			rotate : this.el.querySelector('.player__controls > button.player-button--rotate'),
			vinylFx : this.el.querySelector('.effects > button.effects__button--vinyleffect'),
			roomFx : [].slice.call(this.el.querySelectorAll('.effects > .effects__irs > .effects__button'))
		};
		// Record Info
		this.infoElems = {
			artist : this.el.querySelector('.player-info > .artist--player'),
			title : this.el.querySelector('.player-info > .title--player'),
			year : this.el.querySelector('.player-info > .year--player'),
			song : this.el.querySelector('.player-stand > .song')
		};
		// Arm element center point (we will need this to calculate future rotations of the arm).
		var armOffset = this.ui.arm.getBoundingClientRect();
		this.armCenterPoint = { x: armOffset.left + armOffset.width/2, y : armOffset.top + armOffset.height/2 };
		// Arm rotation angle boundaries.
		this.cartridgeMargin = 8 // Since the cartridge is rotated we need to take this in consideration when rotating the arm.
		this.angleInterval = {
			min : 0,
			max : 45
		};

		// Create the audio analyser and the canvas element to visualize the waveform.
		this._createAnalyser();
		
		// Init/Bind events.
		this._initEvents();
	}

	/**
	 * Turntable options/settings.
	 */
	Turntable.prototype.options = {
		// Noise/Scratch buffer
		noiseBuffer : '',
		// Noise/Scratch gain value
		noiseGain : 0.5,
		// Effect buffers
		effectBuffers : [],
		// Callbacks:
		onGoBack : function() { return false; }
	};

	/**
	 * Loads assets usong the AbbeyLoad script.
	 */
	Turntable.prototype._loadAssets = function(assets, callback, onProgress) {
		new AbbeyLoad(assets, function(bufferList) {
			callback(bufferList);
		}, onProgress);
	};

	/**
	 * Loads a record obj.
	 * 从JSON中加载专辑数据
	 */
	Turntable.prototype.loadRecord = function(albumId, callback, onProgress) {
		var self = this;
		
		// 确保音乐库已加载
		if (!musicLibrary) {
			loadMusicLibrary(function(err) {
				if (err) {
					console.error('Failed to load music library:', err);
					return;
				}
				self.loadRecord(albumId, callback, onProgress);
			});
			return;
		}
		
		// 根据ID获取专辑信息
		var album = getAlbumById(albumId);
		if (!album) {
			console.error('Album not found:', albumId);
			return;
		}
		
		this.recordData = {
			artist: album.artist,
			title: album.title,
			year: album.year,
			side1: {
				totalDuration: 0,
				totalBuffers: 0,
				bufferList: [],
				bufferNames: [],
				songTitles: []
			}
		};

		// 构建歌曲路径列表
		var assetsList = [];
		var bufferObj = {};
		var bufferNames = [];
		var songTitles = [];

		// 添加所有歌曲
		album.songs.forEach(function(song, index) {
			var bufferKey = 'buffer' + (index + 1);
			var filePath = 'music/' + album.folder + '/' + song.file;
			
			bufferObj[bufferKey] = filePath;
			songTitles.push({
				key: bufferKey,
				title: song.title,
				track: song.track
			});
		});
		
		assetsList.push(bufferObj);

		// 保存歌曲标题信息
		this.recordData.side1.bufferNames = assetsList;
		this.recordData.side1.songTitles = songTitles;
		
		// 加载音频文件
		this._loadAssets(assetsList, function(bufferList) {
			var _side = self.recordData.side1;
			_side.bufferList = bufferList;
			// 总缓冲区数量
			_side.totalBuffers = objsize(_side.bufferList);
			// 所有缓冲区的总持续时间(秒)
			for(var i = 0; i < _side.totalBuffers; ++i) {
				_side.totalDuration += _side.bufferList['buffer' + (i+1)].duration;
			}

			// 初始化播放状态为第一首歌的开始位置
			self.currentBuffer = 1;
			self.currentSong = 0;
			self.currentSide = 1;
			self.isReady = true; // 播放器已准备好
			self.isPlaying = false; // 默认不自动播放
			
			// 初始化暂停状态
			self.pausedTime = 0; // 记录时间点为00:00
			self.pausedBuffer = 1; // 记录歌曲为第一首
			
			// 设置唱臂位置到初始位置
			self.setArmPos(0);
			
			// 加载封面图片
			self.updateCoverImage(album);
			
			// 更新专辑信息
			self.updateAlbumInfo(album);
			
			// 更新曲目列表
			self.updateTracklist(album);
			
			// 确保初始的track显示正确
			self.updateTrackDisplay(0, album.songs.length);
			
			// 设置初始活动曲目
			self.updateTracklistActiveItem(0);
			
			if (callback) callback();
		}, onProgress);
	};
	
	/**
	 * 更新封面图片
	 */
	Turntable.prototype.updateCoverImage = function(album) {
		var coverPath = 'music/' + album.folder + '/' + album.coverImage;
		var coverImage = document.querySelector('.player__svg-lp image');
		if (coverImage) {
			coverImage.setAttribute('xlink:href', coverPath);
		}
	};

	/**
	 * 更新曲目列表
	 */
	Turntable.prototype.updateTracklist = function(album) {
		var self = this;
		
		console.log('更新曲目列表:', album);
		
		// 确保tracklist元素存在
		if (!this.ui.tracklist) {
			console.error('Tracklist element not found');
			return;
		}
		
		// 清空现有曲目列表
		while (this.ui.tracklist.firstChild) {
			this.ui.tracklist.removeChild(this.ui.tracklist.firstChild);
		}
		
		// 添加曲目
		if (album && album.songs) {
			console.log('添加 ' + album.songs.length + ' 首曲目到列表');
			
			// 更新右上角显示的曲目信息为 "01/06" 格式
			this.updateTrackDisplay(this.currentSong, album.songs.length);
			
			album.songs.forEach(function(song, index) {
				var listItem = document.createElement('li');
				listItem.className = 'tracklist-item' + (index === self.currentSong ? ' active' : '');
				listItem.setAttribute('data-track', index);
				
				var trackNumber = document.createElement('span');
				trackNumber.className = 'tracklist-number';
				trackNumber.textContent = song.track;
				
				var trackTitle = document.createElement('span');
				trackTitle.className = 'tracklist-title-text';
				trackTitle.textContent = song.title;
				
				listItem.appendChild(trackNumber);
				listItem.appendChild(trackTitle);
				
				// 添加点击事件
				listItem.addEventListener('click', function() {
					var trackIndex = parseInt(this.getAttribute('data-track'));
					console.log('点击曲目:', trackIndex, song.title);
					if (trackIndex !== self.currentSong) {
						// 更改当前曲目的active状态
						var currentActive = self.ui.tracklist.querySelector('.tracklist-item.active');
						if (currentActive) {
							currentActive.classList.remove('active');
						}
						this.classList.add('active');
						
						// 选中新曲目并立即开始播放
						self.changeSong(trackIndex);
					} else if (!self.isPlaying) {
						// 如果点击当前播放的曲目但未播放，则开始播放
						self.start();
					}
				});
				
				self.ui.tracklist.appendChild(listItem);
			});
		} else {
			console.warn('没有可添加的曲目');
		}
	};
	
	/**
	 * 更新右上角的曲目显示信息
	 */
	Turntable.prototype.updateTrackDisplay = function(currentIndex, totalTracks) {
		if (!this.infoElems.song) {
			console.error('Song element not found');
			return;
		}
		
		// 将当前曲目索引格式化为两位数
		var currentTrack = (currentIndex + 1).toString().padStart(2, '0');
		// 将总曲目数格式化为两位数
		var totalTracksFormatted = totalTracks.toString().padStart(2, '0');
		
		// 更新显示格式为 "01/06"
		this.infoElems.song.textContent = currentTrack + '/' + totalTracksFormatted;
	};
	
	/**
	 * 切换当前播放曲目
	 */
	Turntable.prototype.changeSong = function(index) {
		console.log('切换曲目:', index);
		
		// 检查索引是否有效
		if (index === undefined || isNaN(index) || index < 0) {
			console.error('无效的曲目索引:', index);
			return;
		}
		
		// 检查recordData是否存在
		if (!this.recordData || !this.recordData.side1) {
			console.error('Record data not loaded yet');
			return;
		}
		
		// 检查索引是否在有效范围内
		if (index >= this.recordData.side1.totalBuffers) {
			console.error('曲目索引超出范围:', index, '总曲目数:', this.recordData.side1.totalBuffers);
			return;
		}
		
		// 停止当前播放的音乐
		if (this.isPlaying) {
			// 不使用stop()方法，因为我们需要切换而不是完全停止
			if (this.source) {
				this.source.onended = null; // 防止触发ended事件
				this.source.stop(0);
			}
		}
		
		// 重置暂停状态
		this.isPaused = false;
		this.pausedTime = 0; // 从头开始播放新歌曲
		
		// 更新当前曲目索引
		this.currentSong = index;
		this.currentBuffer = index + 1; // bufferKey是从1开始的
		
		console.log('设置唱臂位置, progress:', this.currentSong / (this.recordData.side1.totalBuffers-1));
		
		// 更新唱臂位置，使用归一化的进度值
		var progress = 0;
		if (this.recordData.side1.totalBuffers > 1) {
			progress = this.currentSong / (this.recordData.side1.totalBuffers - 1);
		}
		this.setArmPos(progress);
		
		// 更新右上角显示的曲目信息（01/06格式）
		this.updateTrackDisplay(index, this.recordData.side1.totalBuffers);
		
		// 更新曲目列表中的活动项
		this.updateTracklistActiveItem(index);
		
		// 立即开始播放新曲目
		this.isPlaying = true;
		this._play();
		this._operate();
		
		// 更新UI状态
		this._ctrlPlay('play');
	};

	/**
	 * Starts the turntable and starts playing the record.
	 */
	Turntable.prototype.start = function() {
		console.log('开始播放方法调用', '准备好:', this.isReady, '暂停状态:', this.isPaused, '播放状态:', this.isPlaying);
		if( !this.isReady ) {
			console.log('唱片机未准备好，无法开始播放');
			return;
		}
		
		// 每次点击按钮时播放临时噪音效果
		this._playTemporaryNoise();
		
		// 记录当前状态以便调试
		console.log('详细状态检查:', {
			isPaused: this.isPaused,
			pausedTime: this.pausedTime,
			pausedBuffer: this.pausedBuffer,
			pausedArmRotation: this.pausedArmRotation,
			currentBuffer: this.currentBuffer,
			isPlaying: this.isPlaying
		});

		// 设置播放状态
		this.isPlaying = true;
		this.isPaused = false;
		
		// 如果已经暂停，则从记录的位置恢复播放（不改变当前歌曲和时间点）
		if (this.pausedTime !== undefined && this.pausedBuffer !== undefined) {
			console.log('从记录的位置恢复播放');
			// 从暂停的位置恢复播放当前歌曲
			this._playFromPausedPosition();
		} else {
			console.log('开始新的播放');
			// 否则开始新的播放
			// Play all the buffers/tracks.
			this._play();
			// Extra turntable stuff (noise, arm and platter rotations)
			this._operate();
		}
		
		// 控制播放/停止UI状态
		this._ctrlPlay('play');
	};

	/**
	 * 暂停播放，记录当前播放位置
	 */
	Turntable.prototype.pause = function() {
		console.log('暂停方法调用', '播放状态:', this.isPlaying, '音频源存在:', !!this.source);
		if (!this.isPlaying || !this.source) {
			return;
		}
		
		// 每次点击按钮时播放临时噪音效果
		this._playTemporaryNoise();
		
		// 记录暂停位置（保持当前歌曲和时间点不变）
		this.pausedTime = this.audioCtx.currentTime - this.startTime;
		this.pausedBuffer = this.currentBuffer;
		
		// 记录唱臂当前的角度，用于恢复播放时继续
		this.pausedArmRotation = this.armRotation;
		
		console.log('记录暂停位置:', this.pausedTime, '当前缓冲区:', this.pausedBuffer, '唱臂角度:', this.pausedArmRotation);
		
		// 设置暂停状态
		this.isPaused = true;
		this.isPlaying = false;
		
		// 暂时保存source的onended回调，避免触发stop
		var originalOnEnded = this.source.onended;
		this.source.onended = null;
		
		// 停止当前音频源但保留播放位置
		this.source.stop(0);
		
		// 停止噪音和分析
		this._stopNoise();
		this._stopAnalysing();
		
		// 停止唱臂动画和唱片旋转
		dynamics.stop(this.ui.arm);
		this._stopPlatterRotation();
		
		// 更新UI状态
		this._ctrlPlay('stop');
	};

	/**
	 * 从暂停位置恢复播放
	 */
	Turntable.prototype._playFromPausedPosition = function() {
		console.log('从暂停位置恢复播放', '暂停时间:', this.pausedTime, '暂停缓冲区:', this.pausedBuffer, '暂停的唱臂角度:', this.pausedArmRotation);
		if (this.pausedTime === undefined || this.pausedBuffer === undefined) {
			console.log('无法恢复播放: 没有暂停信息');
			return;
		}
		
		try {
			// 确保当前buffer设置正确
			this.currentBuffer = this.pausedBuffer;
			
			// 检查暂停位置是否有效
			if (this.pausedTime < 0 || !this._getCurrentSide().bufferList['buffer' + this.currentBuffer]) {
				console.log('暂停位置无效，从头开始播放');
				this.pausedTime = 0;
				this.currentBuffer = 1;
			}
			
			// 记录开始时间，用于计算播放位置
			this.startTime = this.audioCtx.currentTime - this.pausedTime;
			
			// 创建新的音频源
			this.source = this.audioCtx.createBufferSource();
			this.source.buffer = this._getCurrentSide().bufferList['buffer' + this.currentBuffer];
			
			// 更新右上角显示为track格式 (01/06)
			var currentTrackIndex = this.currentBuffer - 1;
			var totalTracks = this._getCurrentSide().totalBuffers;
			this.updateTrackDisplay(currentTrackIndex, totalTracks);
			
			// 设置音效
			this.setEffect();
			
			console.log('从暂停位置开始播放:', this.pausedTime, '秒, 曲目:', this.currentBuffer);
			
			// 从暂停位置开始播放
			this.source.start(0, this.pausedTime);
			
			// 开始分析
			var self = this;
			if (this.analyserTimeout) {
				clearTimeout(this.analyserTimeout);
			}
			this.analyserTimeout = setTimeout(function() { self._analyse(); }, 0);
			
			// 当前缓冲区播放完成后，跳转到下一个缓冲区
			this.sourceEnded = function() {
				console.log('音频源播放结束事件触发');
				if (self.isDragging) return;
				if (self.currentBuffer < self._getCurrentSide().totalBuffers && self.isPlatterRotating) {
					self.source.stop(0);
					self.currentBuffer++;
					self.pausedTime = 0; // 重置暂停时间
					self._play();
				} else {
					self.stop();
				}
			};
			this.source.onended = this.sourceEnded;
			
			// 先启动唱盘旋转
			this._startPlatterRotation();
			
			// 计算剩余播放时间
			var currentTrackDuration = this._getCurrentSide().bufferList['buffer' + this.currentBuffer].duration;
			var remainingTime = currentTrackDuration - this.pausedTime;
			console.log('当前曲目总时长:', currentTrackDuration, '剩余时间:', remainingTime);
			
			// 使用保存的唱臂角度，而不是重新计算
			if (this.pausedArmRotation !== undefined) {
				// 设置唱臂到暂停时的位置
				this.armRotation = this.pausedArmRotation;
				console.log('恢复唱臂到暂停时的角度:', this.armRotation);
				dynamics.css(this.ui.arm, { rotateZ : this.armRotation });
			} else {
				// 如果没有保存的唱臂角度，则计算（兼容旧版本）
				// 从当前位置开始唱臂移动
				// 计算唱臂当前应该在的位置
				var totalDuration = this._getCurrentSide().totalDuration;
				var angleRange = this.angleInterval.max - this.angleInterval.min;
				var elapsedPercent = this.pausedTime / currentTrackDuration;
				
				// 计算当前曲目开始前已经播放的时间
				var previousDuration = 0;
				for (var i = 1; i < this.currentBuffer; i++) {
					previousDuration += this._getCurrentSide().bufferList['buffer' + i].duration;
				}
				
				// 计算总的播放进度百分比
				var totalElapsedPercent = (previousDuration + this.pausedTime) / totalDuration;
				
				// 计算当前应该的唱臂角度
				var currentAngle = this.angleInterval.min + (angleRange * totalElapsedPercent);
				this.armRotation = currentAngle;
				
				console.log('唱臂角度计算:', '最小角度:', this.angleInterval.min, '最大角度:', this.angleInterval.max, '当前角度:', currentAngle);
				console.log('播放进度百分比:', totalElapsedPercent, '当前曲目进度:', elapsedPercent);
				
				// 设置唱臂到正确位置
				dynamics.css(this.ui.arm, { rotateZ : currentAngle });
			}
			
			// 然后继续唱臂动画
			this._animateArm(remainingTime);
			
			console.log('恢复播放成功');
		} catch (error) {
			console.error('恢复播放时出错:', error, error.stack);
			// 如果出错，尝试重置状态并从头开始播放
			this.isPaused = false;
			this.isPlaying = true;
			this.pausedTime = undefined;
			this.pausedBuffer = undefined;
			this.pausedArmRotation = undefined;
			this.currentBuffer = 1;
			this._play();
			this._operate();
			this._ctrlPlay('play');
		}
	};

	/**
	 * 播放临时噪音效果，持续1.5秒
	 */
	Turntable.prototype._playTemporaryNoise = function() {
		// 创建临时噪音效果
		var tempNoise = this.audioCtx.createBufferSource();
		tempNoise.buffer = this.options.noiseBuffer;
		var tempNoiseGain = this.audioCtx.createGain();
		tempNoiseGain.gain.value = this.options.noiseGain;
		tempNoise.connect(tempNoiseGain);
		tempNoiseGain.connect(this.audioCtx.destination);
		
		// 开始播放噪音
		tempNoise.start(0);
		
		// 1.5秒后停止噪音
		setTimeout(function() {
			tempNoise.stop(0);
		}, 1500);
	};

	/**
	 * Gets the current record side.
	 */
	Turntable.prototype._getCurrentSide = function() {
		return this.recordData['side' + this.currentSide];
	};

	/**
	 * Plays all the buffers/tracks.
	 */
	Turntable.prototype._play = function(bufferOffset) {
		// Create a source.
		this.source = this.audioCtx.createBufferSource();
		// Set up its buffer.
		this.source.buffer = this._getCurrentSide().bufferList['buffer' + this.currentBuffer];
		
		// 更新右上角显示为track格式 (01/06)
		// 当前曲目索引(从0开始)为this.currentBuffer-1
		var currentTrackIndex = this.currentBuffer - 1;
		var totalTracks = this._getCurrentSide().totalBuffers;
		this.updateTrackDisplay(currentTrackIndex, totalTracks);
		
		// 更新曲目列表中的活动项
		this.updateTracklistActiveItem(currentTrackIndex);
		
		// Set up the room effect and the right audio nodes´ connections.
		this.setEffect();
		// Start playing the current buffer. 
		// If bufferOffset is passed then start playing it from then on. 
		// Also, if starting from the beginning add a delay of [bufferDelay] seconds before playing the track.
		
		// 记录实际开始时间，用于计算暂停位置
		this.startTime = this.audioCtx.currentTime;
		
		this.source.start(bufferOffset && bufferOffset > 0 ? this.audioCtx.currentTime : this.audioCtx.currentTime + this.bufferDelay, bufferOffset ? bufferOffset : 0);
		// start analysing
		var self = this;
		if( this.analyserTimeout ) {
			clearTimeout(this.analyserTimeout);
		}
		this.analyserTimeout = setTimeout(function() { self._analyse(); }, bufferOffset && bufferOffset > 0 ? 0 : this.bufferDelay*1000);
		// When the current buffer ends playing, jump to the next buffer in the list.
		var self = this;
		
		this.sourceEnded = function() {
			// If isDragging is true it means the User lifted the tonearm.
			if( self.isDragging ) return;
			if( self.currentBuffer < self._getCurrentSide().totalBuffers && self.isPlatterRotating ) { // keep on playing
				// Update current buffer and stop the current source.
				self.source.stop(0);
				self.currentBuffer++;
				self.currentSong = self.currentBuffer - 1; // 更新当前歌曲索引
				// Recursive..
				self._play();
			}
			else {
				// Stop everything..
				self.stop();
			}
		};
		//this.source.addEventListener('ended', this.sourceEnded);
		this.source.onended = this.sourceEnded;
	};

	/**
	 * Gets the song name from songTitles array
	 */
	Turntable.prototype._getSongName = function(bufferKey) {
		if (!bufferKey) return '';
		
		var songTitles = this._getCurrentSide().songTitles;
		if (!songTitles || !songTitles.length) return '';
		
		var song = songTitles.find(function(item) {
			return item.key === bufferKey;
		});
		
		return song ? song.title : '';
	};

	/**
	 * Creates the analyser and canvas element.
	 */
	Turntable.prototype._createAnalyser = function() {
		this.analyser = this.audioCtx.createAnalyser();
		
		// set up canvas context for visualizer
		this.canvas = document.createElement('canvas');
		this.ui.visualizer.appendChild(this.canvas);
		this.canvasCtx = this.canvas.getContext('2d');

		// Set canvas sizes
		this.canvasSize = {width : this.ui.visualizer.clientWidth, height : this.ui.visualizer.clientHeight};

		this.canvas.setAttribute('width', this.canvasSize.width);
		this.canvas.setAttribute('height', this.canvasSize.height);
	};

	/**
	 * Shows the waveform/oscilloscope.
	 * based on : 
	 * https://github.com/mdn/voice-change-o-matic/blob/gh-pages/scripts/app.js#L123-L167
	 * https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API
	 */
	Turntable.prototype._analyse = function() {
		window.cancelAnimationFrame(this.drawVisual);

		this.analyser.fftSize = 2048;
		var bufferLength = this.analyser.frequencyBinCount,
			dataArray = new Uint8Array(bufferLength),
			WIDTH = this.canvasSize.width,
  			HEIGHT = this.canvasSize.height,
  			self = this;

		this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
		
		var draw = function() {
			self.drawVisual = requestAnimationFrame(draw);
			self.analyser.getByteTimeDomainData(dataArray);

			self.canvasCtx.fillStyle = '#45bd94';
			self.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

			self.canvasCtx.lineWidth = 1;
			self.canvasCtx.strokeStyle = '#474283';

			self.canvasCtx.beginPath();

			var sliceWidth = WIDTH * 1.0 / bufferLength;
			var x = 0;

			for(var i = 0; i < bufferLength; i++) {
				var v = dataArray[i] / 128.0,
					y = v * HEIGHT/2;

				if(i === 0) {
					self.canvasCtx.moveTo(x, y);
				} else {
					self.canvasCtx.lineTo(x, y);
				}

				x += sliceWidth;
			}

			self.canvasCtx.lineTo(WIDTH, HEIGHT/2);
			self.canvasCtx.stroke();
		};
		draw();
	};

	/**
	 * Stops the waveform/oscilloscope.
	 */
	Turntable.prototype._stopAnalysing = function() {
		window.cancelAnimationFrame(this.drawVisual);
		this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	};

	/**
	 * Turns on everything else: tonearm rotation, platter rotation and noise/scratch sound.
	 * @param Number status: 
	 * none || 1 - start all: creates and plays the noise; moves arm to platter; starts the arm rotation; starts the platter rotation.
	 * 2 - turntable is already on and running but tone arm is lifted, so: creates and plays the noise; starts the arm rotation for the @param remainingTime.
	 */
	Turntable.prototype._operate = function(status, remainingTime) {
		var status = status || 1;
		// Create record noise effect.
		this._createNoise();
		// Play it
		this._playNoise();
		
		if( status === 1 ) {
			// Moves the arm to the platter.
			this._moveArmTo(1);
			// Animates the arm along the record by changing its rotation value.
			var self = this;
			this.armtimeout = dynamics.setTimeout(function() {
				self._animateArm();
			}, this.bufferDelay * 1000);
			// Starts the Platter rotation.
			this._startPlatterRotation();
		}
		else if( status === 2 ) {
			var self = this;
			this.armtimeout = dynamics.setTimeout(function() {
				self._animateArm(remainingTime);
			}, remainingTime === this._getCurrentSide().totalDuration ? this.bufferDelay * 1000 : 0);
		}
	};
	
	/**
	 * Stops playing. If the User is not dragging the tonearm it turns of any other extra (arm and platter rotation and noise effect).
	 */
	Turntable.prototype.stop = function() {
		console.log('停止播放调用');
		// 设置播放状态
		this.isPlaying = false;
		this.isPaused = false;
		
		// 不清除暂停相关的变量，保留当前歌曲和时间点记录
		// this.pausedTime 保持不变
		// this.pausedBuffer 保持不变
		// this.pausedArmRotation 保持不变
		
		// Clear any timeout if any.
		if( this.armtimeout ) {
			dynamics.clearTimeout(this.armtimeout);
		}
		
		// Stop the source.
		if( !this.source ) {
			console.log('无音频源，停止操作终止');
			return;
		}
		
		console.log('停止音频源和重置UI状态');
		this.source.removeEventListener('ended', this.sourceEnded);
		this.source.stop(0);

		this._stopNoise();
		this._stopAnalysing();
		
		// Stop any arm animation.
		dynamics.stop(this.ui.arm);

		// If not dragging then reset tonearm position and platter rotation...
		if( !this.isDragging ) {
			this._moveArmTo(0);
			this._stopPlatterRotation();
			this._ctrlPlay('stop');
		}
	};

	/**
	 * Resume playing the list of buffers after the User drops the tonearm on the platter.
	 */
	Turntable.prototype._resume = function() {
		// Check if the tonearm is being dropped "on" the platter (keep playing) or outside of it (stop everything and return the arm to its resting position).
		if( this.armRotation < this.angleInterval.min || this.armRotation >= this.angleInterval.max ) {
			this._moveArmTo(0);
			this._stopPlatterRotation();
			// Control the play/stop ctrls status.
			this._ctrlPlay('stop');
		}
		else {
			// Calculate which current buffer and in which part of it the pointer/needle is at.
			var currentInfo = this._getCurrentInfoFromAngle();
			// Update the current buffer idx.
			this.currentBuffer = currentInfo.bufferIdx;
			// Play all the buffers/tracks from this point on.
			this._play(currentInfo.bufferOffset);
			// Extra turntable stuff (noise, arm and platter rotations)
			this._operate(2, currentInfo.remainingTime);
		}
	};

	/**
	 * Gets the info of the current buffer and the total remaining time given the current tonearm rotation.
	 */
	Turntable.prototype._getCurrentInfoFromAngle = function() {
		var bufferIdx = -1,
			durations = 0,
			prevDurations = 0,
			bufferOffset = -1,
			offsetDuration = this.armRotation * this._getCurrentSide().totalDuration / (this.angleInterval.max - this.angleInterval.min) - (this.angleInterval.min * this._getCurrentSide().totalDuration / (this.angleInterval.max - this.angleInterval.min));
		
		for(var i = 0; i < this._getCurrentSide().totalBuffers; ++i) {
			durations += this._getCurrentSide().bufferList['buffer' + (i+1)].duration;
			if( offsetDuration < durations ) {
				bufferIdx = i+1;
				bufferOffset = offsetDuration - prevDurations;
				break;
			}
			else {
				prevDurations = durations;
			}
		}

		return {
			// Total remaining time.
			remainingTime : this._getCurrentSide().totalDuration - offsetDuration,
			// Current buffer position.
			bufferIdx : bufferIdx,
			// Current buffer time.
			bufferOffset : bufferOffset
		}
	};

	/**
	 * Creates the Audio Node for the noise/scratch effect.
	 */
	Turntable.prototype._createNoise = function() {
		this.noise = this.audioCtx.createBufferSource();
		this.noise.buffer = this.options.noiseBuffer;
		this.noiseGain = this.audioCtx.createGain();
		this.noiseGain.gain.value = this.noiseVal;
		this.noise.connect(this.noiseGain);
		this.noiseGain.connect(this.audioCtx.destination);
		this.noise.loop = true;
	};

	/**
	 * Plays the noise/scratch effect.
	 */
	Turntable.prototype._playNoise = function() {
		this.noise.start(0);
	};

	/**
	 * Stops the noise/scratch effect.
	 */
	Turntable.prototype._stopNoise = function(until) {
		this.noise.stop(0);
	};

	/**
	 * Adjusts the noise/scratch gain value.
	 */
	Turntable.prototype._adjustNoiseGain = function(val) {
		if( this.noiseGain ) {
			this.noiseGain.gain.value = val;
		}
	};

	/**
	 * Sets the noise/scratch gain value.
	 */
	Turntable.prototype.setNoise = function(status) {
		this.noiseVal = status ? this.options.noiseGain : 0;
		this._adjustNoiseGain(this.noiseVal);
	};

	/**
	 * 设置音频处理链路连接
	 * 注意：room音效已移除，此函数已简化为只处理无效果的情况
	 */
	Turntable.prototype.setEffect = function(idx) {
		// 始终设置为-1表示无效果（room音效已移除）
		this.effect = -1;

		if( !this.source ) { return; }
		
		// 重新调整音频节点连接
		this.source.disconnect();
		if(this.convolver) this.convolver.disconnect();
		this.source.connect(this.analyser);
		this.analyser.connect(this.speakers);
	};

	/**
	 * Gets the min/max angle that the tonearm needs to be rotated to start/finish playing the record.
	 * Calcuations are based on the principle of circle intersection (in this case the LP record with the arm trajectory circle).
	 * Formulas explained here: http://paulbourke.net/geometry/circlesphere/ & http://stackoverflow.com/a/12221389.
	 */
	Turntable.prototype._getAngle = function(el1) {
		var el1Offset = el1.getBoundingClientRect(),
			armOffset = this.ui.arm.getBoundingClientRect(),
			
			// radius and center points of both circles
			r1 = el1Offset.width/2,
			x1 = el1Offset.left + el1Offset.width/2,
			y1 = el1Offset.top + el1Offset.height/2,
			r2 = armOffset.width/2,
			x2 = armOffset.left + armOffset.width/2,
			y2 = armOffset.top + armOffset.height/2,

			// circle intersection
			intersection = circleIntersection(x1,y1,r1,x2,y2,r2),

			// angle
			deg = Math.atan2(this.armCenterPoint.y - intersection.y,this.armCenterPoint.x - intersection.x)*180/Math.PI;
		
		// since the cartridge is rotated we need to take this in consideration when rotating the arm
		return deg + 90 - this.cartridgeMargin;
	};

	/**
	 * Moves the tonearm to the platter (position = 1) or to the resting position (position = 0).
	 */
	Turntable.prototype._moveArmTo = function(position, duration) {
		dynamics.stop(this.ui.arm);
		dynamics.animate(this.ui.arm, {
			rotateZ : position ? this.angleInterval.min : 0
		},{
			duration: duration || 1000,
			type: dynamics.spring,
			frequency: 200,
			friction: 400
		});

		// update current rotation
		this.armRotation = position ? this.angleInterval.min : 0
	};

	/**
	 * Moves the tonearm along the platter while the tracks are playing.
	 */
	Turntable.prototype._animateArm = function(duration) {
		console.log('_animateArm调用, 持续时间:', duration);
		
		var self = this,
			// Angle intervals.
			angleMax = this.angleInterval.max,
			angleMin = this.armRotation > 0 ? this.armRotation : this.angleInterval.min;

		dynamics.stop(this.ui.arm);
		
		// 计算实际动画持续时间
		var animationDuration;
		if (duration != undefined && duration !== this._getCurrentSide().totalDuration) {
			animationDuration = duration * 1000;
		} else {
			animationDuration = (this._getCurrentSide().totalDuration + this.bufferDelay) * 1000;
		}
		
		console.log('唱臂动画设置:', '起始角度:', angleMin, '结束角度:', angleMax, '动画时长:', animationDuration);
		
		dynamics.animate(this.ui.arm, {
			rotateZ : this.angleInterval.max
		}, {
			duration: animationDuration,
			type: dynamics.linear,
			change: function(el, progress) {
				// Update current rotation.
				self.armRotation = (angleMax - angleMin)*progress + angleMin;
			}
		});
	};

	/**
	 * Starts the rotation animation of the Platter.
	 */
	Turntable.prototype._startPlatterRotation = function() {
		console.log('唱盘开始旋转');
		this.isPlatterRotating = true;
		classie.add(this.ui.player, 'player__element--lp-spin');
	};

	/**
	 * Stops the rotation animation of the Platter.
	 */
	Turntable.prototype._stopPlatterRotation = function() {
		console.log('唱盘停止旋转');
		this.isPlatterRotating = false;
		classie.remove(this.ui.player, 'player__element--lp-spin');
	};

	/**
	 * Sets the turntable record info.
	 */
	Turntable.prototype.setRecordInfo = function(record) {
		this.infoElems.artist.innerHTML = record.artist;
		this.infoElems.title.innerHTML = record.title;
		this.infoElems.year.innerHTML = record.year;
	};

	/**
	 * Init/Bind events.
	 */
	Turntable.prototype._initEvents = function() {
		// Dragging functionality based on http://tutorialzine.com/2011/11/pretty-switches-css3-jquery/
		var self = this, 
			startDeg = -1, currentDeg = 0, rad2deg = 180/Math.PI;

		// Mousedown event.
		this.startDragging = function() {
			// Start dragging. 
			self.isDragging = true;
			// Current rotation.
			currentDeg = self.armRotation ? self.armRotation : currentDeg;
			// If playing then stop playing and stop the animation of the tonearm element.
			if( self.source ) {
				self.stop();
			}

			document.addEventListener('mousemove', self.dragging);
			document.addEventListener('mouseup', self.stopDragging);
		};

		// Mousemove event.
		this.dragging = function(ev) {
			var deg = Math.atan2(self.armCenterPoint.y - ev.pageY, self.armCenterPoint.x - ev.pageX) * rad2deg;
			// Save the starting position of the drag.
			if( !startDeg || startDeg == -1 ){
				startDeg = deg;
			}
			// Calculating the current rotation.
			var tmp = (deg-startDeg) + self.armRotation;
			// Making sure the current rotation stays between 0 and this.angleInterval.max.
			if( tmp < 0 ){
				tmp = 0;
			}
			else if( tmp > self.angleInterval.max ){
				tmp = self.angleInterval.max;
			}
			currentDeg = tmp;
			
			// update the tonearm rotation value
			dynamics.css(self.ui.arm, { rotateZ : currentDeg });
		};

		// Mouseup event.
		this.stopDragging = function() {
			self.isDragging = false;

			document.removeEventListener('mousemove', self.dragging);
			document.removeEventListener('mouseup', self.stopDragging);

			// Saving the current rotation.
			self.armRotation = currentDeg;
			// Marking the starting degree as invalid.
			startDeg = -1;
			// If isPlatterRotating = true then keep playing.
			if( self.isPlatterRotating ) {
				self._resume();
			}
		};

		// Start dragging the tonearm elem.
		this.ui.arm.addEventListener('mousedown', this.startDragging);

		// Window resize.
		this.debounceResize = debounce(function(ev) {
			// Recalculate arm center point.
			var armOffset = self.ui.arm.getBoundingClientRect();
			self.armCenterPoint = { x: armOffset.left + armOffset.width/2, y : armOffset.top + armOffset.height/2 };
			
			// Recalculate angle interval.
			self.angleInterval = {
				min : self._getAngle(self.ui.player),
				max : self._getAngle(self.ui.recordCover)
			};

			// reset Canvas/Analyser sizes
			if( self.drawVisual ) {
				self.canvasSize = {width : self.ui.visualizer.clientWidth, height : self.ui.visualizer.clientHeight};
				self.canvas.setAttribute('width', self.canvasSize.width);
				self.canvas.setAttribute('height', self.canvasSize.height);
				self._analyse();
			}
		}, 10);
		window.addEventListener('resize', this.debounceResize);

		// Controls.
		// Back to the Slideshow/Single view
		if (this.ctrls.back) {
			this.ctrls.back.addEventListener('click', function() {
				self._ctrlBack();
			});
		}

		// Play/Stop turntable.
		this.ctrls.play.addEventListener('click', function() {
			console.log('播放按钮点击事件触发 (原始事件), 当前状态:', self.isPlaying ? '播放中' : (self.isPaused ? '已暂停' : '已停止'));
			if (self.isPlaying) {
				// 如果当前正在播放，则暂停，但保持记录的歌曲和时间点
				self.pause();
			} else {
				// 如果当前暂停或停止，则从当前记录的歌曲和时间点开始播放
				self.start();
			}
		});

		this.touchStartFix = function() {
			var buffer = self.audioCtx.createBuffer(1, 1, 22050);
			var source = self.audioCtx.createBufferSource();

			source.buffer = buffer;
			source.connect(self.audioCtx.destination);
			source.start(0);
			window.removeEventListener('touchstart', self.touchStartFix);
		};
		window.addEventListener('touchstart', this.touchStartFix);
	};

	/**
	 * User clicks the back button on the Turntable view. 
	 * Turntable stops.
	 */
	Turntable.prototype._ctrlBack = function() {
		// Stop all.
		this.stop();
		// Callback.
		this.options.onGoBack();
		// Reset side / Show side A.
		if( classie.has(this.ui.player, 'player__element--lp-flip') ) {
			classie.remove(this.ui.player, 'player__element--lp-flip');	
		}
	};

	/**
	 * Play/Stop button.
	 */
	Turntable.prototype._ctrlPlay = function(status) {
		console.log('更新播放控制UI:', status);
		classie.remove(status === 'stop' ? this.ctrls.playStatus : this.ctrls.stopStatus, 'icon--hidden');
		classie.add(status === 'stop' ? this.ctrls.stopStatus : this.ctrls.playStatus, 'icon--hidden');
	};

	/**
	 * Record obj.
	 */
	function Record(el) {
		this.wrapper = el;
		this.cover = this.wrapper.querySelector('.img-wrap--single');
		this.position = this.wrapper.querySelector('.number');
		this.artist = this.wrapper.querySelector('.artist');
		this.title = this.wrapper.querySelector('.title');
		this.year = this.wrapper.querySelector('.year');
		
		// 存储专辑ID，用于从JSON中查找专辑
		this.albumId = this.wrapper.id;

		// 保持原有信息结构，用于兼容
		this.info = {
			coverImg : this.cover.querySelector('img').src,
			artist : this.artist.innerHTML,
			title : this.title.innerHTML,
			year : this.year.innerHTML
		};
	}

	/**
	 * Position the record.
	 */
	Record.prototype.layout = function(place) {
		switch(place) {
			case 'down' :
				dynamics.css(this.cover, { opacity: 1, translateY : winsize.height });
				dynamics.css(this.position, { opacity: 1, translateY : winsize.height - 200 });
				dynamics.css(this.artist, { opacity: 1, translateY : winsize.height - 200 });
				dynamics.css(this.title, { opacity: 1, translateY : winsize.height - 180 });
				dynamics.css(this.year, { opacity: 1, translateY : winsize.height - 250 });
				break;
			case 'right' :
				dynamics.css(this.cover, { opacity: 1, translateX : winsize.width + 600 });
				dynamics.css(this.position, { opacity: 1, translateX : winsize.width + 150 });
				dynamics.css(this.artist, { opacity: 1, translateX : winsize.width });
				dynamics.css(this.title, { opacity: 1, translateX : winsize.width + 150 });
				dynamics.css(this.year, { opacity: 1, translateX : winsize.width + 50 });
				break;
			case 'left' :
				dynamics.css(this.cover, { opacity: 1, translateX : -winsize.width - 600 });
				dynamics.css(this.position, { opacity: 1, translateX : -winsize.width - 150 });
				dynamics.css(this.artist, { opacity: 1, translateX : -winsize.width });
				dynamics.css(this.title, { opacity: 1, translateX : -winsize.width - 150 });
				dynamics.css(this.year, { opacity: 1, translateX : -winsize.width - 50 });
				break;
			case 'hidden' :
				dynamics.css(this.cover, { opacity: 0 });
				dynamics.css(this.position, { opacity: 0 });
				dynamics.css(this.artist, { opacity: 0 });
				dynamics.css(this.title, { opacity: 0 });
				dynamics.css(this.year, { opacity: 0 });
				break;
		};
	};

	/**
	 * Animate the record.
	 */
	Record.prototype.animate = function(direction, callback) {
		var duration = 600,
			type = dynamics.bezier,
			points = [{"x":0,"y":0,"cp":[{"x":0.2,"y":1}]},{"x":1,"y":1,"cp":[{"x":0.3,"y":1}]}],
			transform = {
				'left' : { translateX : -winsize.width, translateY : 0, opacity : 1 },
				'right' : { translateX : winsize.width, translateY : 0, opacity : 1 },
				'center' : { translateX : 0, translateY : 0, opacity : 1 }
			};

		dynamics.animate(this.cover, transform[direction], { duration : duration, type : type, points : points, complete : function() { 
			if( typeof callback === 'function' ) {
				callback();
			}
		} });
		dynamics.animate(this.position, transform[direction], { duration : duration, type : type, points : points });
		dynamics.animate(this.artist, transform[direction], { duration : duration, type : type, points : points });
		dynamics.animate(this.title, transform[direction], { duration : duration, type : type, points : points });
		dynamics.animate(this.year, transform[direction], { duration : duration, type : type, points : points });
	};

	/**
	 * Slideshow obj.
	 */
	function RecordSlideshow(el, options) {
		this.el = el;

		// Options/Settings.
		this.options = extend( {}, this.options );
		extend( this.options, options );

		// Slideshow items.
		this.records = [];
		var self = this;
		[].slice.call(this.el.querySelectorAll('.single')).forEach(function(el) {
			var record = new Record(el);
			self.records.push(record);
		});
		// Total items.
		this.recordsTotal = this.records.length;
		// Current record idx.
		this.current = 0;
		// Slideshow controls.
		this.ctrls = {
			next : this.el.querySelector('.controls__navigate > button.control-button--next'),
			prev : this.el.querySelector('.controls__navigate > button.control-button--prev'),
			play : this.el.querySelector('button.control-button--play')
			// 返回按钮已移除
		};

		this.lpPlayCtrlPath = this.ctrls.play.querySelector('svg.icon--progress > path');
		this.lpPlayCtrlPathLen = this.lpPlayCtrlPath.getTotalLength();
		dynamics.css(this.lpPlayCtrlPath, {strokeDasharray : this.lpPlayCtrlPathLen, strokeDashoffset : this.lpPlayCtrlPathLen});
		
		this._initEvents();
	}

	/**
	 * RecordSlideshow options/settings.
	 */
	RecordSlideshow.prototype.options = {
		// On stop callback.
		onStop : function() { return false; },
		// On load record callback.
		onLoadRecord : function() { return false; },
		// On show record callback.
		onShowRecord : function() { return false; }
	};

	/**
	 * Shows the first record.
	 */
	RecordSlideshow.prototype.start = function(pos) {
		this.current = pos;
		var currentRecord = this.records[this.current];
		classie.add(currentRecord.wrapper, 'single--current');
		currentRecord.layout('down');
		currentRecord.animate('center');
		// show play ctrl
		this._showPlayCtrl();
	};

	/**
	 * Restart where it was. Called when transitioning from the player view to the slideshow/single view.
	 */
	RecordSlideshow.prototype.restart = function(callback) {
		var currentRecord = this.records[this.current];
		classie.add(currentRecord.wrapper, 'single--current');
		currentRecord.layout('left');
		currentRecord.animate('center', callback);
		// show play ctrl
		this._showPlayCtrl();
	};

	/**
	 * Init/Bind events.
	 */
	RecordSlideshow.prototype._initEvents = function() {
		var self = this;
		// 确保元素存在再添加事件监听
		if (this.ctrls.next) {
			this.ctrls.next.addEventListener('click', function() {
				self._navigate('right');
			});
		}
		
		if (this.ctrls.prev) {
			this.ctrls.prev.addEventListener('click', function() {
				self._navigate('left');
			});
		}
		
		// 返回按钮已移除，不再添加事件监听
		
		if (this.ctrls.play) {
			this.ctrls.play.addEventListener('click', function() {
				self._loadRecord();
			});
		}
	};

	/**
	 * Navigate.
	 */
	RecordSlideshow.prototype._navigate = function(direction) {
		var self = this;

		// If the user clicked play on a previous record, then cancel it.
		if( this.isLoading ) {
			this._cancelRecordLoading();
		}

		// hide play ctrl
		this._hidePlayCtrl();

		var currentRecord = this.records[this.current];
		
		if( direction === 'right' ) {
			this.current = this.current < this.recordsTotal - 1 ? this.current + 1 : 0;
		} 
		else {
			this.current = this.current > 0 ? this.current - 1 : this.recordsTotal - 1;
		}

		var nextRecord = this.records[this.current];
		classie.add(nextRecord.wrapper, 'single--current');

		currentRecord.animate(direction === 'right' ? 'left' : 'right', function() {
			classie.remove(currentRecord.wrapper, 'single--current');
		});

		nextRecord.layout(direction);
		nextRecord.animate('center', function() {
			// show play ctrl
			self._showPlayCtrl();
		});
	};

	/**
	 * Load the record.
	 */
	RecordSlideshow.prototype._loadRecord = function() {
		// If already pressed return.
		if( this.isLoading ) {
			return false;
		}
		// Hide play symbol
		classie.add(this.ctrls.play, 'control-button--active');

		// Loading...
		this.isLoading = true;
		// Callback.
		this.options.onLoadRecord(this.records[this.current], this.lpPlayCtrlPath, this.lpPlayCtrlPathLen);
	};

	/**
	 * Show record.
	 */
	RecordSlideshow.prototype._showRecord = function() {
		var self = this;
		
		// If the user didn't click play then return.
		if( !this.isLoading ) {
			return false;
		}

		var currentRecord = this.records[this.current];
		currentRecord.animate('left', function() {
			currentRecord.layout('hidden');
			classie.remove(currentRecord.wrapper, 'single--current');
		});
		
		// hide play ctrl
		this._hidePlayCtrl();

		// Callback.
		this.options.onShowRecord(currentRecord);

		// Invalidate.
		this._cancelRecordLoading();
	};

	/**
	 * Stop the slideshow.
	 */
	RecordSlideshow.prototype._stop = function() {
		// If the user clicked play on a previous record, then cancel it.
		if( this.isLoading ) {
			this._cancelRecordLoading();
		}

		var currentRecord = this.records[this.current];
		currentRecord.layout('hidden');
		classie.remove(currentRecord.wrapper, 'single--current');

		// hide play ctrl
		this._hidePlayCtrl();

		// Callback.
		this.options.onStop();
	};

	/**
	 * Cancel the loading of a record (either because the user pressed the navigation keys, or closed the slideshow after clicking the play ctrl of a specific record).
	 */
	RecordSlideshow.prototype._cancelRecordLoading = function() {
		this.isLoading = false;
		// Show play symbol
		classie.remove(this.ctrls.play, 'control-button--active');
		dynamics.stop(this.lpPlayCtrlPath);
		dynamics.css(this.lpPlayCtrlPath, {strokeDasharray : this.lpPlayCtrlPathLen, strokeDashoffset : this.lpPlayCtrlPathLen});
	};

	/**
	 * Shows the play ctrl.
	 */
	RecordSlideshow.prototype._showPlayCtrl = function() {
		dynamics.animate(this.ctrls.play, { opacity : 1 }, { duration : 200, type : dynamics.easeOut });
	};

	/**
	 * Hides the play ctrl.
	 */
	RecordSlideshow.prototype._hidePlayCtrl = function() {
		dynamics.css(this.ctrls.play, { opacity : 0 });
	};
	
	/* UI */

	// Single/Slideshow/ Player views - 移除了网格视图
	var views = {
			single : document.querySelector('.view--single'),
			player : document.querySelector('.view--player')
		},
		// 当前视图默认为播放器视图
		currentView = views.player,
		expanderEl = document.querySelector('.deco-expander'),
		// The LP svg behing each Slideshow record
		recordEl = views.player.querySelector('.player__element--lp'),
		slideshow, turntable,
		// 标记是否是直接加载的第一张专辑
		isDirectLoaded = true;

	/**
	 * 初始化
	 */
	function init() {
		var onready = function() {
			// 首先加载音乐库
			loadMusicLibrary(function(err, library) {
				if (err) {
					console.error('Failed to load music library:', err);
					return;
				}
				
				console.log('Music library loaded:', library);
				
				// 只在需要时才生成详情视图
				if (views.single) {
					generateDetailView(library);
				}
				
				// 只在详情视图存在时才初始化幻灯片
				if (document.querySelector('.view--single')) {
					slideshow = new RecordSlideshow(document.querySelector('.view--single'), {
						// Stopping/Closing the slideshow: 直接返回播放器视图
						onStop : function() {
							changeView('single', 'player');
							hideExpander();
						},
						onLoadRecord : function(record, progressEl, progressElLen) {
							// 使用专辑ID从音乐库加载唱片
							var albumId = record.albumId;
							console.log('Loading album by ID:', albumId);
							
							// Load the record info into the turntable.
							turntable.loadRecord(albumId, function() {
								// 获取专辑信息
								var album = getAlbumById(albumId);
								if (album) {
									// 更新唱片机上的信息
									turntable.setRecordInfo({
										artist: album.artist,
										title: album.title,
										year: album.year
									});
								}
								setTimeout(function() { slideshow._showRecord(); }, 50);
							}, function(progress) {
								if (slideshow.isLoading) {
									dynamics.animate(progressEl, {strokeDashoffset : progressElLen * (1 - progress/100)}, {duration : 100, type : dynamics.linear});
								}
							});
						},
						onShowRecord : function(record) {
							// 获取专辑信息
							var album = getAlbumById(record.albumId);
							if (!album) return;
							
							// 构建封面图片路径
							var coverPath = 'music/' + album.folder + '/' + album.coverImage;
							
							// Show record element.
							dynamics.css(recordEl, { opacity : 1 });
							// Change the cover of the record.
							recordEl.querySelector('image').setAttribute('xlink:href', coverPath);
							// Change view.
							changeView('single', 'player');
							// 从单曲视图进入播放器视图，设置标志为false
							isDirectLoaded = false;
						}
					});
				}
				// 加载第一张专辑
				if (musicLibrary && musicLibrary.albums && musicLibrary.albums.length > 0) {
					var firstAlbum = musicLibrary.albums[0];
					console.log('Loading first album:', firstAlbum);
					
					// 更新唱片机上的信息
					document.querySelector('.artist--player').textContent = firstAlbum.artist;
					document.querySelector('.title--player').textContent = firstAlbum.title;
					document.querySelector('.year--player').textContent = firstAlbum.year;
					
					// 显示唱片元素
					dynamics.css(recordEl, { opacity : 1 });
					
					// 设置唱片封面图片
					var coverPath = 'music/' + firstAlbum.folder + '/' + firstAlbum.coverImage;
					console.log('加载封面图片路径:', coverPath);
					
					// 设置播放器视图中的封面图片
					var coverImage = recordEl.querySelector('image');
					if (coverImage) {
						coverImage.setAttribute('xlink:href', coverPath);
					}
					
					// 初始化slideshow到第一个位置
					slideshow.current = 0;
					
					// 加载唱片信息到唱片机
					turntable.loadRecord(firstAlbum.id, function() {
						// 更新唱片机上的信息
						turntable.setRecordInfo({
							artist: firstAlbum.artist,
							title: firstAlbum.title,
							year: firstAlbum.year
						});
						
						// 确保当前视图是播放器视图
						classie.remove(views.player, 'view--hidden');
						classie.add(views.player, 'view--current');
						
					}, function(progress) {
						// 处理加载进度
						console.log("加载进度: " + progress + "%");
					});
				}
			});
		};
		preload(onready);
	}

	/**
	 * Preload turntable assets. Initialize the turntable.
	 */
	function preload(callback) {
		// 加载唱片机资源（噪音和音效）
		loadTurntableAssets(function(bufferList) {
			initTurntable(bufferList);
			if (typeof callback === 'function') {
				callback();
			}
		});
	}

	// 移除了initGridLayout函数，因为不再需要网格视图

	function loadTurntableAssets(callback) {
		new AbbeyLoad([{ 
			// room音效已移除，只保留noise音效
			'noise' : 'mp3/noise1.mp3'
		}], function(bufferList) {
			if( typeof callback === 'function' ) {
				callback(bufferList);
			}
		});
	};

	function initTurntable(bufferList) {
		// initialize turntable
		turntable = new Turntable(views.player, {
			noiseBuffer	: bufferList['noise'],
			effectBuffers : [], // room音效已移除，使用空数组
			onGoBack : function() {
				// 检查是否有专辑详情视图的单曲元素，如果没有才直接返回网格视图
				var singleElements = document.querySelectorAll('.view--single .single');
				if (singleElements.length > 0) {
					changeView('player', 'single');
					// 如果slideshow存在，则重启它
					if (slideshow) {
						slideshow.restart(function() {
							// Hide record element.
							dynamics.css(recordEl, { opacity : 0 });
						});
					} else {
						// Hide record element.
						dynamics.css(recordEl, { opacity : 0 });
					}
				} else {
					// 否则直接返回网格视图
					changeView('player', 'grid');
					// Hide record element.
					dynamics.css(recordEl, { opacity : 0 });
				}
			}
		});
		
		// 确保初始状态正确设置
		turntable.isPlaying = false;
		turntable.isPaused = false;
		turntable.pausedTime = undefined;
		turntable.pausedBuffer = undefined;
		turntable.noiseVal = 0; // 确保噪音效果初始设置为0
		turntable.currentSide = 1; // 总是设置为A面，因为没有翻转按钮
		
		// 确保初始时按钮显示为三角形(播放)而不是方块(暂停)
		var playStatus = views.player.querySelector('.player__controls > button.player-button--playstop .icon--play');
		var stopStatus = views.player.querySelector('.player__controls > button.player-button--playstop .icon--stop');
		
		// 确保显示播放图标(三角形)，隐藏停止图标(方块)
		classie.remove(playStatus, 'icon--hidden');
		classie.add(stopStatus, 'icon--hidden');
		
		console.log('唱片机初始化完成，状态:', {
			isPlaying: turntable.isPlaying,
			isPaused: turntable.isPaused,
			isReady: turntable.isReady,
			noiseVal: turntable.noiseVal,
			currentSide: turntable.currentSide
		});
	}

	function changeView(old, current) {
		classie.remove(views[old], 'view--current');
		classie.add(views[current], 'view--current');
	}

	function initEvents() {
		lps.forEach(function(lp, pos) {
			lp.addEventListener('click', function(ev) {
				ev.preventDefault();
				
				// 确保音乐库已加载
				if (!musicLibrary) {
					console.error('Music library not loaded yet.');
					return;
				}
				
				// 获取专辑ID
				var albumId = lp.querySelector('.grid__link').getAttribute('href').substring(1);
				
				// 确认专辑在音乐库中存在
				var album = getAlbumById(albumId);
				if (!album) {
					console.error('Album not found in music library:', albumId);
					return;
				}
				
				showExpander({x: ev.pageX, y: ev.pageY}, function() {
					changeView('grid', 'single');
				});
				
				// Start the slideshow.
				setTimeout(function() { slideshow.start(pos);}, 80);
			});
		});

		// Window resize.
		var debounceResize = debounce(function(ev) {
			// Recalculate window sizes.
			winsize = {width : window.innerWidth, height : window.innerHeight};
		}, 10);
		window.addEventListener('resize', debounceResize);
	}

	function showExpander(position, callback) {
		dynamics.css(expanderEl, { opacity: 1, left : position.x, top : position.y, backgroundColor : '#45918e', scale : 0 });
		dynamics.animate(expanderEl, { 
			scale : 1.5, 
			backgroundColor : '#45cb96' 
		}, { 
			duration : 500, 
			type : dynamics.easeOut,
			complete : function() {
				if( typeof callback === 'function' ) {
					callback();
				}
			}
		});
	}

	function hideExpander() {
		dynamics.css(expanderEl, { left : window.innerWidth/2, top : window.innerHeight/2 });
		dynamics.animate(expanderEl, { 
			opacity : 0
		}, { 
			duration : 500, 
			type : dynamics.easeOut
		});
	}

	/**
	 * 根据音乐库数据生成网格视图
	 */
	function generateGridView(library) {
		// 获取网格容器
		var gridContainer = document.querySelector('.grid');
		if (!gridContainer) return;
		
		// 清空原有内容
		gridContainer.innerHTML = '';
		
		// 遍历所有专辑并添加到网格
		library.albums.forEach(function(album, index) {
			// 创建专辑元素
			var albumElement = document.createElement('li');
			albumElement.className = 'grid__item' + (index % 4 === 1 ? ' grid__item--deco grid__item--deco-' + (Math.floor(index / 4) % 3 + 1) : '');
			
			// 图片路径
			var coverPath = 'music/' + album.folder + '/' + album.coverImage;
			
			// 设置专辑内容
			albumElement.innerHTML = `
				<a class="grid__link" href="#${album.id}">
					<div class="img-wrap img-wrap--grid">
						<svg class="lp lp--grid">
							<use xlink:href="#icon-lp-mini"></use>
						</svg>
						<img class="img img--grid" src="${coverPath}" alt="${album.title}" />
					</div>
					<span class="year">${album.year}</span>
					<h2 class="artist">${album.artist}</h2>
					<h3 class="title">${album.title}</h3>
				</a>
			`;
			
			// 添加到网格
			gridContainer.appendChild(albumElement);
		});
		
		// 更新lps数组，包含所有新创建的专辑元素
		lps = [].slice.call(gridContainer.querySelectorAll('li.grid__item'));
		
		// 重新初始化网格布局
		imagesLoaded(views.grid, function() {
			new Masonry('.grid', {
				itemSelector: '.grid__item'
			});
		});
	}
	
	/**
	 * 根据音乐库数据生成详情视图
	 */
	function generateDetailView(library) {
		// 获取详情视图容器
		var singleContainer = document.querySelector('.view--single');
		if (!singleContainer) return;
		
		// 获取控制区域元素
		var controlsElement = singleContainer.querySelector('.controls');
		if (!controlsElement) return;
		
		// 清空原有单曲元素(只保留控制区域)
		var children = [].slice.call(singleContainer.children);
		children.forEach(function(child) {
			if (!child.classList.contains('controls')) {
				singleContainer.removeChild(child);
			}
		});
		
		// 遍历所有专辑并创建详情视图
		library.albums.forEach(function(album, index) {
			// 创建专辑详情元素
			var singleElement = document.createElement('div');
			singleElement.className = 'single';
			singleElement.id = album.id;
			
			// 图片路径
			var coverPath = 'music/' + album.folder + '/' + album.coverImage;
			
			// 设置专辑详情内容
			singleElement.innerHTML = `
				<div class="img-wrap img-wrap--single">
					<img class="img img--single" src="${coverPath}" alt="${album.title}" />
				</div>
				<span class="number">${(index+1).toString().padStart(2, '0')}<span class="number__total">${library.albums.length}</span></span>
				<h2 class="artist artist--single">${album.artist}</h2>
				<h3 class="title title--single">${album.title}</h3>
				<span class="year year--single">${album.year}</span>
			`;
			
			// 将详情元素插入到控制区域之前
			singleContainer.insertBefore(singleElement, controlsElement);
		});
	}

	init();

	window.AudioContext = window.AudioContext||window.webkitAudioContext;

	/**
	 * 设置唱臂位置
	 * @param {number} progress - 播放进度，范围0-1
	 */
	Turntable.prototype.setArmPos = function(progress) {
		if (!this.ui.arm) return;
		
		var self = this;
		// 默认为初始位置（唱片边缘）
		var angle = this.angleInterval.min;
		
		if (progress !== undefined && !isNaN(progress)) {
			// 根据进度计算角度，从最小到最大
			angle = this.angleInterval.min + (this.angleInterval.max - this.angleInterval.min) * progress;
		}
		
		// 确保角度在有效范围内
		angle = Math.max(this.angleInterval.min, Math.min(angle, this.angleInterval.max));
		
		// 设置唱臂旋转
		dynamics.animate(this.ui.arm, {
			rotateZ : angle
		}, {
			type : dynamics.spring,
			duration : 500,
			friction : 400
		});
		
		// 保存当前角度
		this.armRotation = angle;
	};

	/**
	 * 更新播放器UI中的专辑信息
	 */
	Turntable.prototype.updateAlbumInfo = function(album) {
		// 更新专辑信息
		this.infoElems.title.textContent = album.title; // 第一行显示专辑名称
		this.infoElems.artist.textContent = album.artist; // 第二行显示歌手名
		this.infoElems.year.textContent = album.year;
	};

	/**
	 * 更新曲目列表中的当前活动项
	 */
	Turntable.prototype.updateTracklistActiveItem = function(activeIndex) {
		// 确保tracklist元素存在
		if (!this.ui.tracklist) return;
		
		// 移除所有active状态
		var allItems = this.ui.tracklist.querySelectorAll('.tracklist-item');
		for (var i = 0; i < allItems.length; i++) {
			allItems[i].classList.remove('active');
		}
		
		// 添加active状态到当前曲目
		var activeItem = this.ui.tracklist.querySelector('.tracklist-item[data-track="' + activeIndex + '"]');
		if (activeItem) {
			activeItem.classList.add('active');
		}
	};

})(window);