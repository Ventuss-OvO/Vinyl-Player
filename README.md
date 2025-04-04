# Vinyl Player - 交互式黑胶唱片播放器

一个基于 [Web Audio API](https://www.w3.org/TR/webaudio/) 开发的交互式黑胶唱片播放器模拟器，提供了逼真的唱片播放体验和视觉效果。

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

## 使用方法

### 本地运行

python3 -m http.server



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

