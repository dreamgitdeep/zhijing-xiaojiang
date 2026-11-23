# CSS Mask\-Image 实现鼠标跟随显示图片效果

植景小匠的首页要呈现出鼠标跟随显示图片的效果，核心是利用 CSS `mask-image` 结合 JavaScript 实现，以下是完整步骤和代码示例：

### 一、准备工作

1. **素材准备**：

    - 准备两张尺寸完全一致的图片：

        - 底层图：默认显示的基础图（如开满各种鲜花、绿树成荫的社区）

        - 上层图：需要鼠标跟随显示的图（如开满各种鲜花、绿树成荫的社区）

    - 也可以直接用 AI 生成两张同构图、同尺寸的图片。

2. **浏览器兼容性处理**：

    - 现代浏览器（Chrome 120\+、Edge 120\+、Firefox 53\+、Safari 15\.4\+）支持标准`mask-image`

    - 为兼容旧版 Chrome/Safari，需要同时写`-webkit-mask-image`前缀。

### 二、核心实现原理

1. **HTML 结构**：创建一个容器，里面包含底层图和上层图。

2. **CSS 样式**：

    - 容器设置为相对定位，两张图绝对定位且完全重叠。

    - 上层图设置`mask-image`，用径向渐变创建一个圆形透明区域（鼠标位置），其余区域用黑色遮挡。

    - 用 CSS 变量动态控制遮罩的位置和大小。

3. **JavaScript 逻辑**：

    - 监听鼠标移动事件，获取鼠标在容器内的坐标。

    - 动态更新上层图的 CSS 变量，控制遮罩跟随鼠标移动。

### 三、完整代码示例

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>鼠标跟随显示图片效果</title>
    <style>
        .container {
            position: relative;
            width: 800px;
            height: 600px;
            margin: 50px auto;
            overflow: hidden;
        }
        .base-img, .reveal-img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .reveal-img {
            /* 核心：用径向渐变创建遮罩，鼠标位置为透明区域 */
            mask-image: radial-gradient(
                circle var(--radius, 150px) at var(--x, 50%) var(--y, 50%),
                transparent 0%,
                transparent 50%,
                black 100%
            );
            -webkit-mask-image: radial-gradient(
                circle var(--radius, 150px) at var(--x, 50%) var(--y, 50%),
                transparent 0%,
                transparent 50%,
                black 100%
            );
            /* 平滑过渡遮罩位置 */
            transition: mask-position 0.06s linear;
            transition: -webkit-mask-position 0.06s linear;
        }
    </style>
</head>
<body>
    <div class="container">
        <img class="base-img" src="base.jpg" alt="底层图">
        <img class="reveal-img" src="reveal.jpg" alt="上层图">
    </div>

    <script>
        const container = document.querySelector('.container');
        const revealImg = document.querySelector('.reveal-img');

        // 监听鼠标移动事件
        container.addEventListener('mousemove', (e) => {
            // 获取容器的位置和尺寸
            const rect = container.getBoundingClientRect();
            // 计算鼠标在容器内的相对坐标（百分比）
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            // 更新CSS变量，控制遮罩位置
            revealImg.style.setProperty('--x', `${x}%`);
            revealImg.style.setProperty('--y', `${y}%`);
        });

        // 鼠标离开容器时，隐藏遮罩
        container.addEventListener('mouseleave', () => {
            revealImg.style.setProperty('--radius', '0px');
        });

        // 鼠标进入容器时，恢复遮罩大小
        container.addEventListener('mouseenter', () => {
            revealImg.style.setProperty('--radius', '150px');
        });
    </script>
</body>
</html>
```

### 四、优化建议

1. **性能优化**：

    - 使用`requestAnimationFrame`优化鼠标移动的动画流畅度。

    - 限制鼠标移动事件的触发频率，避免频繁更新 CSS 变量。

2. **效果增强**：

    - 可以调整径向渐变的大小和边缘模糊程度，让过渡更自然。

    - 可以添加缩放、旋转等额外动画，让效果更丰富。



> （注：部分内容可能由 AI 生成）
