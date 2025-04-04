# Vinyl Player - 交互式黑胶唱片播放器

一个基于 [Web Audio API](https://www.w3.org/TR/webaudio/) 开发的交互式黑胶唱片播放器模拟器，提供了逼真的唱片播放体验和视觉效果。

[原始文章链接 - Codrops](http://tympanus.net/codrops/?p=27200)

[在线演示](http://tympanus.net/Development/RecordPlayer/)

## 项目概述

本项目是一个模拟黑胶唱片播放器的Web应用，用户可以浏览专辑列表，选择喜欢的专辑进行播放，并体验真实的黑胶唱片播放效果，包括唱臂移动、唱片旋转、音频可视化等功能。

## 技术栈

- **前端基础**: HTML5, CSS3, JavaScript (ES5/ES6)
- **音频处理**: Web Audio API
- **动画效果**: Dynamics.js
- **布局系统**: Masonry.js
- **资源加载**: Abbey Load
- **DOM操作**: Classie.js
- **现代化支持**: Modernizr

## 主要功能

1. **专辑浏览**: 网格布局展示所有可用专辑
2. **唱片播放**: 模拟真实唱片播放器的播放体验
3. **音频可视化**: 实时显示音频波形
4. **曲目列表**: 显示当前专辑的所有曲目
5. **唱片互动**: 可拖动唱臂，模拟真实唱片操作
6. **音乐库管理**: 通过JSON文件管理音乐资源

## 项目结构

```
├── css/                  # 样式文件
├── fonts/                # 字体文件
├── img/                  # 图片资源
├── js/                   # JavaScript文件
│   ├── abbey-load.js     # 资源加载库
│   ├── classie.js        # DOM操作工具
│   ├── dynamics.min.js   # 动画效果库
│   ├── main.js           # 主要应用逻辑
│   └── ...               # 其他JS库
├── mp3/                  # 音效文件
├── music/                # 音乐文件和专辑数据
│   ├── music-library.json  # 音乐库配置
│   └── ...               # 专辑文件夹
└── index.html            # 主页面
```

## License

Integrate or build upon it for free in your personal or commercial projects. Don't republish, redistribute or sell "as-is". 

Read more here: [License](http://tympanus.net/codrops/licensing/)

## Credits

*   Acoustic impulse response data from [OpenAIR: The Open Acoustic Impulse Response Library](http://www.openairlib.net/) licensed under [Attribution Share Alike Creative Commons license](http://creativecommons.org/licenses/by-sa/3.0/)
*   [Abbey Load](http://stuartmemo.com/abbey-load/) by [Stuart Memo](http://stuartmemo.com/) licensed under [MIT](https://opensource.org/licenses/MIT)
*   Audio visualization made with [Visualizations with Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) and [Voice-change-o-matic](https://github.com/mdn/voice-change-o-matic/blob/gh-pages/scripts/app.js#L123-L167)
*   Animations powered by Michael Villar's [Dynamics.js](http://dynamicsjs.com/)
*   All remixes by [Ivan Chew](http://ccmixter.org/people/ramblinglibrarian/profile) © 2016 Licensed under a Creative Commons Attribution (3.0) license [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). More free remixes: [http://dig.ccmixter.org/free](http://dig.ccmixter.org/free)
*   [Vinyl NoiseSFX](http://logic-pro-expert.com/logic-pro-blog/2014/08/18/free-vinyl-noise-samples-99sounds.html#.V1Lfu5MrLfY) by Chia: All the sounds included in Vinyl Noise SFX have been recorded and edited by Chia. These samples are the property of Chia and they are hosted on 99Sounds with his permission. You are hereby granted a license to use these samples for both non-commercial and commercial purposes, provided that the samples are not used as part of another sample library or a virtual instrument.
*   Records icon made by [Madebyoliver](http://www.flaticon.com/authors/madebyoliver "Madebyoliver") from [www.flaticon.com](http://www.flaticon.com "Flaticon"), licensed under [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/ "Creative Commons BY 3.0")
*   Stadium, cathedral, guitar icons made by [Freepik](http://www.flaticon.com/authors/freepik "Freepik") from [www.flaticon.com](http://www.flaticon.com "Flaticon"), licensed under [CC 3.0 BY](http://creativecommons.org/licenses/by/3.0/ "Creative Commons BY 3.0")
*   [Getting Started with Web Audio API](http://www.html5rocks.com/en/tutorials/webaudio/intro/) by Boris Smus on HTML5Rocks

## Misc

Follow Codrops: [Twitter](http://www.twitter.com/codrops), [Facebook](http://www.facebook.com/pages/Codrops/159107397912), [Google+](https://plus.google.com/101095823814290637419), [GitHub](https://github.com/codrops), [Pinterest](http://www.pinterest.com/codrops/)

[© Codrops 2016](http://www.codrops.com)

## 使用方法

### 本地运行

1. 克隆或下载项目到本地
2. 使用本地服务器运行项目（如 Live Server、Python SimpleHTTPServer 等）
3. 在浏览器中访问对应地址

### 操作指南

1. **浏览专辑**: 打开应用后，可以看到专辑网格视图，点击任意专辑进入播放界面
2. **播放控制**: 
   - 点击播放按钮开始播放
   - 拖动唱臂可以改变播放位置
   - 点击曲目列表中的曲目可以切换播放的歌曲
3. **返回网格**: 点击左下角的返回按钮可以回到专辑网格视图

## 最近更新

界面已经简化：
- 主页面现在是唱片播放器视图，而不是专辑网格
- 页面加载时会自动加载第一张专辑，但不会自动播放
- 播放器视图中的返回按钮可直接返回到网格视图
- 点击播放按钮可以开始播放

## 自定义音乐库

可以通过修改 `music/music-library.json` 文件来自定义音乐库：

```json
{
  "albums": [
    {
      "id": "album-id",
      "folder": "album_folder_name",
      "artist": "艺术家名称",
      "title": "专辑标题",
      "year": "发行年份",
      "coverImage": "封面图片文件名.jpg",
      "tracks": 歌曲数量,
      "songs": [
        {
          "file": "歌曲文件名.mp3",
          "title": "歌曲标题",
          "track": 曲目序号
        },
        // 更多歌曲...
      ]
    },
    // 更多专辑...
  ]
}
```

## 开发者说明

如需扩展或修改项目，请参考以下关键文件：

- `js/main.js`: 主要应用逻辑和音频处理
- `css/style.css`: 样式定义
- `index.html`: 页面结构
- `music/music-library.json`: 音乐库配置

