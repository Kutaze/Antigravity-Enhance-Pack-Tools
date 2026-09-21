using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Media.Imaging;

namespace AntigravityInstaller
{
    public class App : Application
    {
        [STAThread]
        public static void Main(string[] args)
        {
            var app = new App();
            bool isDark = false; // Default to modern light mode
            if (args != null && args.Length > 0)
            {
                foreach (var a in args)
                {
                    if (a.Equals("/dark", StringComparison.OrdinalIgnoreCase) || a.Equals("-dark", StringComparison.OrdinalIgnoreCase))
                    {
                        isDark = true;
                    }
                    else if (a.Equals("/light", StringComparison.OrdinalIgnoreCase) || a.Equals("-light", StringComparison.OrdinalIgnoreCase))
                    {
                        isDark = false;
                    }
                }
            }
            var mainWindow = new MainWindow(isDark);
            app.Run(mainWindow);
        }
    }

    public class FeatureChipData
    {
        public Border Border { get; set; }
        public TextBlock TitleBlock { get; set; }
        public TextBlock DescBlock { get; set; }
    }

    public class MainWindow : Window
    {
        // Controls
        private Border rootBorder;
        private Grid titleBar;
        private TextBlock titleText;
        private Border verBadge;
        private TextBlock verBadgeText;
        private Button btnTheme;
        private Button btnMin;
        private Button btnClose;

        private Border bannerBorder;
        private TextBlock bannerTitle;
        private TextBlock bannerSubtitle;

        private TextBlock pathHeader;
        private Border pathBoxBorder;
        private TextBox txtPath;
        private TextBlock lblPathStatus;
        private Button btnBrowse;

        private List<FeatureChipData> featureChips = new List<FeatureChipData>();

        private TextBlock lblStatus;
        private ProgressBar progressBar;
        private Border logBorder;
        private TextBox txtLog;

        private Grid bottomGrid;
        private CheckBox chkAutoLaunch;
        private Button btnRestore;
        private Button btnInstall;

        private string detectedInstallDir;
        private bool isWorking = false;
        private bool isDarkMode = false;

        public MainWindow(bool startDark = false)
        {
            isDarkMode = startDark;

            Title = "Antigravity 深度汉化与原生 UI 增强工具箱";
            Width = 720;
            Height = 630;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = Brushes.Transparent;

            BuildUI();
            ApplyTheme(isDarkMode);
            DetectPath();
        }

        private void BuildUI()
        {
            rootBorder = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(14)
            };

            var mainGrid = new Grid();
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(44) }); // Header
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Content
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(66) }); // Bottom Actions

            // ================= 1. Custom Title Bar =================
            titleBar = new Grid();
            titleBar.MouseLeftButtonDown += (s, e) => { if (e.ButtonState == MouseButtonState.Pressed) DragMove(); };

            var titleLeft = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(16, 0, 0, 0)
            };

            var iconImage = LoadEmbeddedImage("icon.png");
            if (iconImage != null)
            {
                titleLeft.Children.Add(new Image
                {
                    Source = iconImage,
                    Width = 20,
                    Height = 20,
                    Margin = new Thickness(0, 0, 8, 0)
                });
            }

            titleText = new TextBlock
            {
                Text = "Antigravity 深度汉化与原生 UI 增强工具箱",
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                VerticalAlignment = VerticalAlignment.Center
            };
            titleLeft.Children.Add(titleText);

            verBadge = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(6, 1.5, 6, 1.5),
                Margin = new Thickness(8, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            verBadgeText = new TextBlock
            {
                Text = "v2.5 Pro",
                FontSize = 10.5,
                FontWeight = FontWeights.Medium
            };
            verBadge.Child = verBadgeText;
            titleLeft.Children.Add(verBadge);
            titleBar.Children.Add(titleLeft);

            // Title Bar Right (Theme toggle + Min + Close)
            var titleRight = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 10, 0)
            };

            btnTheme = new Button
            {
                Height = 26,
                Padding = new Thickness(8, 0, 8, 0),
                Margin = new Thickness(0, 0, 8, 0),
                FontSize = 11,
                Cursor = Cursors.Hand,
                VerticalAlignment = VerticalAlignment.Center
            };
            btnTheme.Click += (s, e) => ApplyTheme(!isDarkMode);
            titleRight.Children.Add(btnTheme);

            btnMin = CreateWindowButton("—", (s, e) => WindowState = WindowState.Minimized);
            btnClose = CreateWindowButton("✕", (s, e) => Close(), true);
            titleRight.Children.Add(btnMin);
            titleRight.Children.Add(btnClose);
            titleBar.Children.Add(titleRight);

            Grid.SetRow(titleBar, 0);
            mainGrid.Children.Add(titleBar);

            // ================= 2. Body Content =================
            var bodyStack = new StackPanel
            {
                Margin = new Thickness(20, 14, 20, 10)
            };

            // Banner Card
            bannerBorder = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(14, 12, 14, 12),
                Margin = new Thickness(0, 0, 0, 14)
            };

            var bannerGrid = new Grid();
            bannerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(50) });
            bannerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            if (iconImage != null)
            {
                var bannerLogo = new Image
                {
                    Source = iconImage,
                    Width = 42,
                    Height = 42,
                    HorizontalAlignment = HorizontalAlignment.Left,
                    VerticalAlignment = VerticalAlignment.Center,
                    Effect = new DropShadowEffect
                    {
                        Color = Color.FromRgb(99, 102, 241),
                        BlurRadius = 12,
                        Opacity = 0.5,
                        ShadowDepth = 0
                    }
                };
                Grid.SetColumn(bannerLogo, 0);
                bannerGrid.Children.Add(bannerLogo);
            }

            var bannerTextStack = new StackPanel
            {
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(4, 0, 0, 0)
            };
            bannerTitle = new TextBlock
            {
                Text = "Antigravity × Google Gemini 深度增强扩展包",
                FontSize = 15,
                FontWeight = FontWeights.Bold
            };
            bannerSubtitle = new TextBlock
            {
                Text = "全界面深度汉化 · 动态上下文用量监测 · 4 挡思考滑块 · 实时额度卡片 · 防卡死守护",
                FontSize = 11.5,
                Margin = new Thickness(0, 3, 0, 0)
            };
            bannerTextStack.Children.Add(bannerTitle);
            bannerTextStack.Children.Add(bannerSubtitle);
            Grid.SetColumn(bannerTextStack, 1);
            bannerGrid.Children.Add(bannerTextStack);
            bannerBorder.Child = bannerGrid;
            bodyStack.Children.Add(bannerBorder);

            // Path Selection Card
            pathHeader = new TextBlock
            {
                Text = "客户端安装目录:",
                FontSize = 12.5,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(2, 0, 0, 6)
            };
            bodyStack.Children.Add(pathHeader);

            var pathRow = new Grid { Margin = new Thickness(0, 0, 0, 4) };
            pathRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            pathRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(85) });

            pathBoxBorder = new Border
            {
                Height = 34,
                CornerRadius = new CornerRadius(6),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(10, 0, 10, 0)
            };

            txtPath = new TextBox
            {
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                FontSize = 12,
                VerticalAlignment = VerticalAlignment.Center
            };
            txtPath.TextChanged += (s, e) => ValidatePath();
            pathBoxBorder.Child = txtPath;
            Grid.SetColumn(pathBoxBorder, 0);
            pathRow.Children.Add(pathBoxBorder);

            btnBrowse = CreateStyledButton("浏览...", new CornerRadius(6), 34, new Thickness(12, 0, 12, 0));
            btnBrowse.Margin = new Thickness(8, 0, 0, 0);
            btnBrowse.Click += BtnBrowse_Click;
            Grid.SetColumn(btnBrowse, 1);
            pathRow.Children.Add(btnBrowse);
            bodyStack.Children.Add(pathRow);

            lblPathStatus = new TextBlock
            {
                Text = "正在检测客户端安装目录...",
                FontSize = 11,
                Margin = new Thickness(2, 0, 0, 12)
            };
            bodyStack.Children.Add(lblPathStatus);

            // Enhancement Features Chips (2-column layout)
            var featuresWrap = new UniformGrid
            {
                Columns = 2,
                Margin = new Thickness(0, 0, 0, 12)
            };
            featuresWrap.Children.Add(AddFeatureChip("🈳 全界面深度汉化", "覆盖所有菜单、弹窗与侧边栏"));
            featuresWrap.Children.Add(AddFeatureChip("📈 真实上下文动态监测", "毫秒级实时统计，自适应模型上限"));
            featuresWrap.Children.Add(AddFeatureChip("🧠 思考能力 4 挡滑块", "动静态模型参数绑定，紫粉高光"));
            featuresWrap.Children.Add(AddFeatureChip("📊 实时额度与消耗面板", "支持 Gemini / Claude 额度轮询"));
            featuresWrap.Children.Add(AddFeatureChip("⚡ 品牌聚变 Logo", "任务栏、视窗、侧边栏全套聚变"));
            featuresWrap.Children.Add(AddFeatureChip("🛡️ 防死循环守护引擎", "DOM 缓存守卫，彻底告别卡死"));
            bodyStack.Children.Add(featuresWrap);

            // Progress Bar & Status Text
            lblStatus = new TextBlock
            {
                Text = "就绪状态：可点击下方按钮一键安装或还原官方版。",
                FontSize = 12,
                FontWeight = FontWeights.Medium,
                Margin = new Thickness(2, 0, 0, 6)
            };
            bodyStack.Children.Add(lblStatus);

            progressBar = new ProgressBar
            {
                Height = 6,
                BorderThickness = new Thickness(0),
                Value = 0,
                Maximum = 100,
                Margin = new Thickness(0, 0, 0, 8)
            };
            bodyStack.Children.Add(progressBar);

            // Live Log Console Box inside Border
            logBorder = new Border
            {
                Height = 90,
                CornerRadius = new CornerRadius(8),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(6, 4, 6, 4)
            };

            txtLog = new TextBox
            {
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                FontFamily = new FontFamily("Consolas, Courier New"),
                FontSize = 10.5,
                IsReadOnly = true,
                VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
                TextWrapping = TextWrapping.Wrap
            };
            logBorder.Child = txtLog;
            bodyStack.Children.Add(logBorder);

            Grid.SetRow(bodyStack, 1);
            mainGrid.Children.Add(bodyStack);

            // ================= 3. Bottom Action Row =================
            bottomGrid = new Grid
            {
                Margin = new Thickness(0)
            };
            bottomGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            bottomGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Auto) });

            chkAutoLaunch = new CheckBox
            {
                Content = "安装完成后自动启动 Antigravity",
                IsChecked = true,
                FontSize = 12,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(20, 0, 0, 0),
                Cursor = Cursors.Hand
            };
            Grid.SetColumn(chkAutoLaunch, 0);
            bottomGrid.Children.Add(chkAutoLaunch);

            var buttonStack = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(0, 0, 20, 0)
            };

            btnRestore = CreateStyledButton("↺ 一键还原官方原版", new CornerRadius(8), 36, new Thickness(16, 0, 16, 0), false);
            btnRestore.Margin = new Thickness(0, 0, 10, 0);
            btnRestore.Click += BtnRestore_Click;
            buttonStack.Children.Add(btnRestore);

            btnInstall = CreateStyledButton(
                "🚀 一键安装 / 更新增强补丁",
                new CornerRadius(8),
                36,
                new Thickness(20, 0, 20, 0),
                true,
                new DropShadowEffect
                {
                    Color = Color.FromRgb(99, 102, 241),
                    BlurRadius = 10,
                    Opacity = 0.4,
                    ShadowDepth = 1
                }
            );
            btnInstall.Click += BtnInstall_Click;
            buttonStack.Children.Add(btnInstall);

            Grid.SetColumn(buttonStack, 1);
            bottomGrid.Children.Add(buttonStack);

            Grid.SetRow(bottomGrid, 2);
            mainGrid.Children.Add(bottomGrid);

            rootBorder.Child = mainGrid;
            Content = rootBorder;
        }

        public void ApplyTheme(bool dark)
        {
            isDarkMode = dark;

            if (dark)
            {
                // Dark Theme Palette (Deep Midnight Slate)
                rootBorder.Background = new SolidColorBrush(Color.FromRgb(15, 23, 42)); // Slate 900
                rootBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)); // Slate 700
                rootBorder.Effect = new DropShadowEffect
                {
                    Color = Colors.Black,
                    Direction = 270,
                    ShadowDepth = 8,
                    BlurRadius = 24,
                    Opacity = 0.55
                };

                titleBar.Background = new SolidColorBrush(Color.FromRgb(30, 41, 59)); // Slate 800
                titleText.Foreground = new SolidColorBrush(Color.FromRgb(241, 245, 249));

                verBadge.Background = new SolidColorBrush(Color.FromArgb(50, 99, 102, 241));
                verBadge.BorderBrush = new SolidColorBrush(Color.FromArgb(120, 99, 102, 241));
                verBadgeText.Foreground = new SolidColorBrush(Color.FromRgb(165, 180, 252));

                btnTheme.Content = "☀️ 浅色模式";
                UpdateButtonStyle(btnTheme,
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                    new CornerRadius(4));

                UpdateWindowButtonStyle(btnMin, false, true);
                UpdateWindowButtonStyle(btnClose, true, true);

                bannerBorder.Background = new LinearGradientBrush(
                    Color.FromRgb(30, 27, 75), // Indigo 950
                    Color.FromRgb(15, 23, 42), // Slate 900
                    new Point(0, 0),
                    new Point(1, 1)
                );
                bannerBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(67, 56, 202));
                bannerTitle.Foreground = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                bannerSubtitle.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));

                pathHeader.Foreground = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                pathBoxBorder.Background = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                pathBoxBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(71, 85, 105));
                txtPath.Foreground = new SolidColorBrush(Color.FromRgb(241, 245, 249));
                txtPath.CaretBrush = Brushes.White;

                UpdateButtonStyle(btnBrowse,
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new SolidColorBrush(Color.FromRgb(241, 245, 249)),
                    new CornerRadius(6));

                foreach (var chip in featureChips)
                {
                    chip.Border.Background = new SolidColorBrush(Color.FromArgb(45, 30, 41, 59));
                    chip.Border.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85));
                    chip.TitleBlock.Foreground = new SolidColorBrush(Color.FromRgb(241, 245, 249));
                    chip.DescBlock.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));
                }

                lblStatus.Foreground = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                progressBar.Background = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                progressBar.Foreground = new LinearGradientBrush(Color.FromRgb(99, 102, 241), Color.FromRgb(168, 85, 247), 0);

                logBorder.Background = new SolidColorBrush(Color.FromRgb(10, 15, 30));
                logBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                txtLog.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));

                bottomGrid.Background = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                chkAutoLaunch.Foreground = new SolidColorBrush(Color.FromRgb(203, 213, 225));

                UpdateButtonStyle(btnRestore,
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                    new CornerRadius(8));

                UpdateButtonStyle(btnInstall,
                    new LinearGradientBrush(Color.FromRgb(79, 70, 229), Color.FromRgb(124, 58, 237), 0),
                    Brushes.White,
                    new CornerRadius(8));
            }
            else
            {
                // Light Theme Palette (Modern Apple/Fluent Crisp Light)
                rootBorder.Background = new SolidColorBrush(Color.FromRgb(255, 255, 255)); // White
                rootBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)); // Slate 300
                rootBorder.Effect = new DropShadowEffect
                {
                    Color = Color.FromRgb(100, 116, 139),
                    Direction = 270,
                    ShadowDepth = 6,
                    BlurRadius = 24,
                    Opacity = 0.28
                };

                titleBar.Background = new SolidColorBrush(Color.FromRgb(248, 250, 252)); // Slate 50
                titleText.Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)); // Slate 900

                verBadge.Background = new SolidColorBrush(Color.FromRgb(224, 231, 255)); // Indigo 100
                verBadge.BorderBrush = new SolidColorBrush(Color.FromRgb(165, 180, 252)); // Indigo 300
                verBadgeText.Foreground = new SolidColorBrush(Color.FromRgb(67, 56, 202)); // Indigo 700

                btnTheme.Content = "🌙 深色模式";
                UpdateButtonStyle(btnTheme,
                    new SolidColorBrush(Color.FromRgb(241, 245, 249)),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new CornerRadius(4));

                UpdateWindowButtonStyle(btnMin, false, false);
                UpdateWindowButtonStyle(btnClose, true, false);

                bannerBorder.Background = new LinearGradientBrush(
                    Color.FromRgb(238, 242, 255), // Indigo 50
                    Color.FromRgb(248, 250, 252), // Slate 50
                    new Point(0, 0),
                    new Point(1, 1)
                );
                bannerBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(199, 210, 254)); // Indigo 200
                bannerTitle.Foreground = new SolidColorBrush(Color.FromRgb(30, 27, 75)); // Indigo 950
                bannerSubtitle.Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)); // Slate 600

                pathHeader.Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                pathBoxBorder.Background = new SolidColorBrush(Color.FromRgb(255, 255, 255));
                pathBoxBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225));
                txtPath.Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42));
                txtPath.CaretBrush = Brushes.Black;

                UpdateButtonStyle(btnBrowse,
                    new SolidColorBrush(Color.FromRgb(241, 245, 249)),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new CornerRadius(6));

                foreach (var chip in featureChips)
                {
                    chip.Border.Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                    chip.Border.BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                    chip.TitleBlock.Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42));
                    chip.DescBlock.Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139));
                }

                lblStatus.Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                progressBar.Background = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                progressBar.Foreground = new LinearGradientBrush(Color.FromRgb(79, 70, 229), Color.FromRgb(147, 51, 234), 0);

                logBorder.Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                logBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                txtLog.Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85));

                bottomGrid.Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                chkAutoLaunch.Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85));

                UpdateButtonStyle(btnRestore,
                    new SolidColorBrush(Color.FromRgb(241, 245, 249)),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new CornerRadius(8));

                UpdateButtonStyle(btnInstall,
                    new LinearGradientBrush(Color.FromRgb(79, 70, 229), Color.FromRgb(124, 58, 237), 0),
                    Brushes.White,
                    new CornerRadius(8));
            }

            ValidatePath();
        }

        private void UpdateButtonStyle(Button btn, Brush bg, Brush fg, CornerRadius radius)
        {
            btn.Background = bg;
            btn.Foreground = fg;

            var template = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.Name = "b";
            borderFactory.SetValue(Border.BackgroundProperty, bg);
            borderFactory.SetValue(Border.CornerRadiusProperty, radius);
            borderFactory.SetValue(Border.PaddingProperty, btn.Padding);
            borderFactory.SetValue(Border.BorderThicknessProperty, new Thickness(1));
            borderFactory.SetValue(Border.BorderBrushProperty, isDarkMode
                ? new SolidColorBrush(Color.FromArgb(70, 255, 255, 255))
                : new SolidColorBrush(Color.FromRgb(203, 213, 225)));

            var cpFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            cpFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            cpFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(cpFactory);

            template.VisualTree = borderFactory;

            var hoverTrigger = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
            hoverTrigger.Setters.Add(new Setter(Button.OpacityProperty, 0.88));
            template.Triggers.Add(hoverTrigger);

            var pressedTrigger = new Trigger { Property = Button.IsPressedProperty, Value = true };
            pressedTrigger.Setters.Add(new Setter(Button.OpacityProperty, 0.72));
            template.Triggers.Add(pressedTrigger);

            var disabledTrigger = new Trigger { Property = Button.IsEnabledProperty, Value = false };
            disabledTrigger.Setters.Add(new Setter(Button.OpacityProperty, 0.4));
            template.Triggers.Add(disabledTrigger);

            btn.Template = template;
        }

        private void UpdateWindowButtonStyle(Button btn, bool isClose, bool isDark)
        {
            btn.Foreground = isDark
                ? new SolidColorBrush(Color.FromRgb(148, 163, 184))
                : new SolidColorBrush(Color.FromRgb(100, 116, 139));

            var template = new ControlTemplate(typeof(Button));
            var borderFactory = new FrameworkElementFactory(typeof(Border));
            borderFactory.Name = "b";
            borderFactory.SetValue(Border.BackgroundProperty, Brushes.Transparent);
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(4));

            var cpFactory = new FrameworkElementFactory(typeof(ContentPresenter));
            cpFactory.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            cpFactory.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            borderFactory.AppendChild(cpFactory);
            template.VisualTree = borderFactory;

            var hoverTrigger = new Trigger { Property = Button.IsMouseOverProperty, Value = true };
            hoverTrigger.Setters.Add(new Setter(Border.BackgroundProperty, isClose
                ? new SolidColorBrush(Color.FromRgb(239, 68, 68))
                : (isDark ? new SolidColorBrush(Color.FromArgb(60, 255, 255, 255)) : new SolidColorBrush(Color.FromRgb(226, 232, 240))), "b"));
            hoverTrigger.Setters.Add(new Setter(Button.ForegroundProperty, isClose ? Brushes.White : (isDark ? Brushes.White : new SolidColorBrush(Color.FromRgb(15, 23, 42)))));
            template.Triggers.Add(hoverTrigger);

            btn.Template = template;
        }

        private Button CreateStyledButton(string text, CornerRadius cornerRadius, double height, Thickness padding, bool isBold = false, Effect effect = null)
        {
            var btn = new Button
            {
                Content = text,
                Height = height,
                Padding = padding,
                BorderThickness = new Thickness(0),
                FontSize = isBold ? 13 : 12,
                FontWeight = isBold ? FontWeights.Bold : FontWeights.Medium,
                Cursor = Cursors.Hand,
                Effect = effect
            };
            return btn;
        }

        private Border AddFeatureChip(string title, string desc)
        {
            var b = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(7),
                Padding = new Thickness(10, 6, 10, 6),
                Margin = new Thickness(3, 3, 3, 3)
            };
            var s = new StackPanel();
            var tbTitle = new TextBlock
            {
                Text = title,
                FontSize = 11.5,
                FontWeight = FontWeights.SemiBold,
                FontFamily = new FontFamily("Segoe UI Emoji, Segoe UI, Microsoft YaHei")
            };
            var tbDesc = new TextBlock
            {
                Text = desc,
                FontSize = 10,
                Margin = new Thickness(0, 2, 0, 0)
            };
            s.Children.Add(tbTitle);
            s.Children.Add(tbDesc);
            b.Child = s;

            featureChips.Add(new FeatureChipData
            {
                Border = b,
                TitleBlock = tbTitle,
                DescBlock = tbDesc
            });

            return b;
        }

        private Button CreateWindowButton(string text, RoutedEventHandler onClick, bool isClose = false)
        {
            var btn = new Button
            {
                Content = text,
                Width = 34,
                Height = 30,
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                FontSize = 12,
                Cursor = Cursors.Hand
            };
            btn.Click += onClick;
            return btn;
        }

        private BitmapImage LoadEmbeddedImage(string resourceName)
        {
            try
            {
                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream(resourceName))
                {
                    if (stream == null) return null;
                    var img = new BitmapImage();
                    img.BeginInit();
                    img.StreamSource = stream;
                    img.CacheOption = BitmapCacheOption.OnLoad;
                    img.EndInit();
                    img.Freeze();
                    return img;
                }
            }
            catch { return null; }
        }

        private void DetectPath()
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "antigravity"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Antigravity"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Antigravity"),
                @"C:\Users\Lynan\AppData\Local\Programs\antigravity"
            };

            foreach (var c in candidates)
            {
                if (!string.IsNullOrEmpty(c) && File.Exists(Path.Combine(c, "resources", "app.asar")))
                {
                    detectedInstallDir = c;
                    txtPath.Text = c;
                    Log("自动检测到 Antigravity 安装目录: " + c);
                    return;
                }
            }

            Log("未能自动定位 Antigravity 目录，请手动点击“浏览”选择。");
            ValidatePath();
        }

        private bool ValidatePath()
        {
            string p = txtPath.Text.Trim();
            if (string.IsNullOrEmpty(p))
            {
                lblPathStatus.Text = "▲ 请输入或选择 Antigravity 安装目录。";
                lblPathStatus.Foreground = new SolidColorBrush(isDarkMode ? Color.FromRgb(245, 158, 11) : Color.FromRgb(217, 119, 6)); // Amber
                btnInstall.IsEnabled = false;
                btnRestore.IsEnabled = false;
                return false;
            }

            string asar = Path.Combine(p, "resources", "app.asar");
            if (File.Exists(asar))
            {
                detectedInstallDir = p;
                lblPathStatus.Text = "● 已定位有效的 Antigravity 客户端目录 (已识别 resources/app.asar)";
                lblPathStatus.Foreground = new SolidColorBrush(isDarkMode ? Color.FromRgb(16, 185, 129) : Color.FromRgb(5, 150, 105)); // Emerald
                btnInstall.IsEnabled = !isWorking;
                btnRestore.IsEnabled = !isWorking;
                return true;
            }
            else
            {
                lblPathStatus.Text = "▲ 未能在该目录下找到 resources/app.asar，请确认所选目录为 Antigravity 安装根目录。";
                lblPathStatus.Foreground = new SolidColorBrush(isDarkMode ? Color.FromRgb(245, 158, 11) : Color.FromRgb(217, 119, 6)); // Amber
                btnInstall.IsEnabled = false;
                btnRestore.IsEnabled = false;
                return false;
            }
        }

        private void BtnBrowse_Click(object sender, RoutedEventArgs e)
        {
            var dlg = new Microsoft.Win32.OpenFileDialog
            {
                Title = "请选择 Antigravity.exe 或 app.asar 文件",
                Filter = "Antigravity 文件 (Antigravity.exe;app.asar)|Antigravity.exe;app.asar|所有文件 (*.*)|*.*",
                CheckFileExists = true
            };

            if (dlg.ShowDialog() == true)
            {
                string sel = dlg.FileName;
                string dir = Path.GetDirectoryName(sel);
                if (Path.GetFileName(sel).Equals("app.asar", StringComparison.OrdinalIgnoreCase))
                {
                    dir = Path.GetDirectoryName(dir); // go up from resources
                }
                txtPath.Text = dir;
                ValidatePath();
            }
        }

        private void Log(string message)
        {
            string line = string.Format("[{0:HH:mm:ss}] {1}", DateTime.Now, message);
            txtLog.AppendText(line + Environment.NewLine);
            txtLog.ScrollToEnd();
        }

        private void SetWorking(bool working, string status)
        {
            isWorking = working;
            btnInstall.IsEnabled = !working;
            btnRestore.IsEnabled = !working;
            btnBrowse.IsEnabled = !working;
            txtPath.IsEnabled = !working;
            lblStatus.Text = status;
        }

        private void BtnInstall_Click(object sender, RoutedEventArgs e)
        {
            if (!ValidatePath()) return;
            string installDir = detectedInstallDir;
            bool autoLaunch = chkAutoLaunch.IsChecked == true;

            SetWorking(true, "正在准备安装环境...");
            progressBar.Value = 5;
            Log("==========================================");
            Log("开始安装 / 更新 Antigravity 增强与汉化补丁...");

            ThreadPool.QueueUserWorkItem(_ =>
            {
                string tempDir = Path.Combine(Path.GetTempPath(), "AgyPatch_" + Guid.NewGuid().ToString("N"));
                try
                {
                    // Step 1: Kill Antigravity
                    Dispatcher.Invoke(() =>
                    {
                        lblStatus.Text = "步骤 1/5: 正在扫描并优雅退出 Antigravity 进程...";
                        progressBar.Value = 15;
                        Log("检查 Antigravity 运行状态并解除文件锁定...");
                    });

                    KillProcesses("Antigravity");
                    Thread.Sleep(800);

                    // Step 2: Extract Payload
                    Dispatcher.Invoke(() =>
                    {
                        lblStatus.Text = "步骤 2/5: 正在提取内置增强引擎与核心资源...";
                        progressBar.Value = 35;
                        Log("提取内置 Payload 扩展包到临时沙箱...");
                    });

                    Directory.CreateDirectory(tempDir);
                    ExtractEmbeddedPayload(tempDir);

                    string patcherJs = Path.Combine(tempDir, "patcher.js");
                    if (!File.Exists(patcherJs))
                    {
                        throw new Exception("解压载荷失败，未找到 patcher.js！");
                    }

                    // Step 3: Find Runner
                    Dispatcher.Invoke(() =>
                    {
                        lblStatus.Text = "步骤 3/5: 正在启动注入与封包引擎...";
                        progressBar.Value = 55;
                        Log("定位脚本运行时 (Node.js / Electron)...");
                    });

                    string runner = null;
                    bool isElectron = false;

                    try
                    {
                        var p = Process.Start(new ProcessStartInfo("where", "node")
                        {
                            UseShellExecute = false,
                            RedirectStandardOutput = true,
                            CreateNoWindow = true
                        });
                        p.WaitForExit();
                        if (p.ExitCode == 0) runner = "node";
                    }
                    catch { }

                    if (string.IsNullOrEmpty(runner))
                    {
                        string electronPath = Path.Combine(installDir, "Antigravity.exe");
                        if (File.Exists(electronPath))
                        {
                            runner = electronPath;
                            isElectron = true;
                        }
                    }

                    if (string.IsNullOrEmpty(runner))
                    {
                        throw new Exception("未找到可用的 Node.js 或 Antigravity.exe 运行时！");
                    }

                    // Step 4: Execute patcher
                    Dispatcher.Invoke(() =>
                    {
                        lblStatus.Text = "步骤 4/5: 正在执行汉化注入、Logo 聚变与防卡死守护封包...";
                        progressBar.Value = 75;
                        Log("调用 patcher.js 注入核心逻辑并生成原子化 app.asar...");
                    });

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = runner,
                        Arguments = "\"" + patcherJs + "\" \"" + installDir + "\"",
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true,
                        StandardOutputEncoding = Encoding.UTF8,
                        StandardErrorEncoding = Encoding.UTF8
                    };
                    if (isElectron)
                    {
                        psi.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
                    }

                    var proc = Process.Start(psi);
                    string stdOut = proc.StandardOutput.ReadToEnd();
                    string stdErr = proc.StandardError.ReadToEnd();
                    proc.WaitForExit();

                    Dispatcher.Invoke(() =>
                    {
                        if (!string.IsNullOrWhiteSpace(stdOut))
                        {
                            var lines = stdOut.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
                            foreach (var l in lines) Log(l);
                        }
                    });

                    if (proc.ExitCode != 0)
                    {
                        throw new Exception("补丁注入返回错误码: " + proc.ExitCode + "\n" + stdErr);
                    }

                    // Step 5: Finish
                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 100;
                        lblStatus.Text = "🎉 安装完成！Antigravity 增强与汉化已全面生效。";
                        Log("✔ 增强与汉化补丁全部部署成功！");
                        SetWorking(false, "🎉 安装完成！");

                        if (autoLaunch)
                        {
                            string exePath = Path.Combine(installDir, "Antigravity.exe");
                            if (File.Exists(exePath))
                            {
                                Process.Start(exePath);
                                Log("已为您自动启动 Antigravity 客户端。");
                            }
                        }

                        MessageBox.Show(this,
                            "恭喜！Antigravity 增强与汉化扩展包已成功安装！\n\n已包含全界面深度汉化、实时动态上下文用量、4 挡思考滑块、额度卡片与防卡死守护。",
                            "安装成功",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    });
                }
                catch (Exception ex)
                {
                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 0;
                        lblStatus.Text = "❌ 安装失败，详情请查看下方日志。";
                        Log("[错误] " + ex.Message);
                        SetWorking(false, "安装失败");

                        MessageBox.Show(this,
                            "安装过程出现错误：\n" + ex.Message,
                            "错误",
                            MessageBoxButton.OK,
                            MessageBoxImage.Error);
                    });
                }
                finally
                {
                    try
                    {
                        if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true);
                    }
                    catch { }
                }
            });
        }

        private void BtnRestore_Click(object sender, RoutedEventArgs e)
        {
            if (!ValidatePath()) return;
            string installDir = detectedInstallDir;
            string backupPath = Path.Combine(installDir, "resources", "app.asar.bak");
            string asarPath = Path.Combine(installDir, "resources", "app.asar");

            if (!File.Exists(backupPath))
            {
                MessageBox.Show(this,
                    "未找到官方备份文件 (resources/app.asar.bak)。\n当前客户端可能已经是官方原生纯净版，或从未安装过增强补丁。",
                    "提示",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
                return;
            }

            var confirm = MessageBox.Show(this,
                "是否确认还原为官方原生纯净版？\n（将恢复为官方原生英文界面，并移除增强组件）",
                "确认还原",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (confirm != MessageBoxResult.Yes) return;

            SetWorking(true, "正在还原官方纯净版...");
            progressBar.Value = 20;
            Log("==========================================");
            Log("开始还原官方原生 app.asar...");

            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    KillProcesses("Antigravity");
                    Thread.Sleep(500);

                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 60;
                        Log("正在从 app.asar.bak 覆盖恢复原生 app.asar...");
                    });

                    File.Copy(backupPath, asarPath, true);

                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 100;
                        lblStatus.Text = "✔ 还原成功！已恢复为官方原生纯净版。";
                        Log("✔ 官方原生纯净版已成功还原。");
                        SetWorking(false, "已还原官方版");

                        if (chkAutoLaunch.IsChecked == true)
                        {
                            string exePath = Path.Combine(installDir, "Antigravity.exe");
                            if (File.Exists(exePath))
                            {
                                Process.Start(exePath);
                                Log("已为您启动 Antigravity 原版客户端。");
                            }
                        }

                        MessageBox.Show(this,
                            "Antigravity 客户端已成功还原为官方原生纯净版！",
                            "还原成功",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    });
                }
                catch (Exception ex)
                {
                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 0;
                        lblStatus.Text = "❌ 还原失败: " + ex.Message;
                        Log("[错误] " + ex.Message);
                        SetWorking(false, "还原失败");

                        MessageBox.Show(this, "还原失败: " + ex.Message, "错误", MessageBoxButton.OK, MessageBoxImage.Error);
                    });
                }
            });
        }

        private void KillProcesses(string name)
        {
            try
            {
                var procs = Process.GetProcessesByName(name);
                if (procs.Length > 0)
                {
                    Dispatcher.Invoke(() => Log("正在关闭 " + procs.Length + " 个运行中的 Antigravity 进程..."));
                    foreach (var p in procs)
                    {
                        try
                        {
                            p.Kill();
                            p.WaitForExit(3000);
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        private void ExtractEmbeddedPayload(string targetDir)
        {
            var asm = Assembly.GetExecutingAssembly();
            using (var stream = asm.GetManifestResourceStream("payload.zip"))
            {
                if (stream == null) throw new Exception("内置 Payload 资源不存在！");
                string tempZip = Path.Combine(targetDir, "_payload.zip");
                using (var fs = new FileStream(tempZip, FileMode.Create, FileAccess.Write))
                {
                    stream.CopyTo(fs);
                }
                ZipFile.ExtractToDirectory(tempZip, targetDir);
                try { File.Delete(tempZip); } catch { }
            }
        }
    }
}
