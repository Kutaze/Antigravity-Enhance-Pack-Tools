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
            bool isDark = false; // Default to clean modern light theme
            bool doCapture = false;
            if (args != null && args.Length >= 4 && (args[0].Equals("/mockup", StringComparison.OrdinalIgnoreCase) || args[0].Equals("--mockup", StringComparison.OrdinalIgnoreCase)))
            {
                AntigravityInstaller.MainWindow.CustomLogoPath = args[1];
                string outLight = args[2];
                string outDark = args[3];
                var win = new AntigravityInstaller.MainWindow(false);
                win.SetupMockupState();
                AntigravityInstaller.MainWindow.SaveVisualAsPng((FrameworkElement)win.Content, outLight);
                win.ApplyTheme(true);
                AntigravityInstaller.MainWindow.SaveVisualAsPng((FrameworkElement)win.Content, outDark);
                return;
            }
            if (args != null && args.Length > 0)
            {
                foreach (var a in args)
                {
                    if (a.Equals("/capture", StringComparison.OrdinalIgnoreCase) || a.Equals("--capture", StringComparison.OrdinalIgnoreCase))
                    {
                        doCapture = true;
                    }
                    else if (a.Equals("/dark", StringComparison.OrdinalIgnoreCase) || a.Equals("-dark", StringComparison.OrdinalIgnoreCase))
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
            if (doCapture)
            {
                mainWindow.ExportPreviews();
                return;
            }
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
        public static string CustomLogoPath { get; set; }

        // Controls
        private Border rootBorder;
        private Grid titleBar;
        private TextBlock titleText;
        private Border verBadge;
        private TextBlock verBadgeText;
        private Button btnAbout;
        private Button btnTheme;
        private Button btnMin;
        private Button btnClose;

        // Footer About & Author Controls
        private Border footerBorder;
        private Border cardAuthor;
        private TextBlock lblAuthorTitle;
        private TextBlock lblAuthorVal;
        private Border cardModel;
        private TextBlock lblModelTitle;
        private TextBlock lblModelVal;
        private Border cardGithub;
        private TextBlock lblGithubTitle;
        private TextBlock lblGithubVal;
        private System.Windows.Shapes.Path pathGithubLogo;
        private List<Border> footerBadges = new List<Border>();
        private List<TextBlock> footerBadgeTexts = new List<TextBlock>();
        private TextBlock lblCopyright;

        private Border bannerBorder;
        private TextBlock bannerTitle;
        private TextBlock bannerSubtitle;

        private TextBlock pathHeader;
        private Border pathBoxBorder;
        private TextBox txtPath;
        private TextBlock lblPathStatus;
        private Button btnAutoSearch;
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

            Title = "Antigravity Enhance Tools (Antigravity 扩展增强工具)";
            Width = 750;
            Height = 745;
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
            WindowStyle = WindowStyle.None;
            AllowsTransparency = true;
            Background = Brushes.Transparent;

            // Enable pixel snapping and ClearType rendering for crisp text
            UseLayoutRounding = true;
            SnapsToDevicePixels = true;
            TextOptions.SetTextFormattingMode(this, TextFormattingMode.Display);
            TextOptions.SetTextRenderingMode(this, TextRenderingMode.ClearType);
            RenderOptions.SetClearTypeHint(this, ClearTypeHint.Enabled);
            FontFamily = new FontFamily("Microsoft YaHei UI, Segoe UI, sans-serif");

            BuildUI();
            ApplyTheme(isDarkMode);
            DetectPath(false);
        }

        private void BuildUI()
        {
            var windowContainer = new Grid();

            rootBorder = new Border
            {
                Margin = new Thickness(10), // Reserved outer space for smooth drop shadow without OS clipping
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(16),
                SnapsToDevicePixels = true,
                UseLayoutRounding = true
            };
            TextOptions.SetTextFormattingMode(rootBorder, TextFormattingMode.Display);
            TextOptions.SetTextRenderingMode(rootBorder, TextRenderingMode.ClearType);
            RenderOptions.SetClearTypeHint(rootBorder, ClearTypeHint.Enabled);

            var mainGrid = new Grid();
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(46) }); // Header
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) }); // Content
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(56) }); // Bottom Actions
            mainGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto }); // Footer: Model, Author, GitHub & About

            // ================= 1. Custom Title Bar =================
            titleBar = new Grid
            {
                Background = Brushes.Transparent // Transparent so rootBorder rounded corners are preserved
            };
            titleBar.MouseLeftButtonDown += (s, e) => { if (e.ButtonState == MouseButtonState.Pressed) DragMove(); };

            var titleLeft = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(18, 0, 0, 0)
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
                Text = "Antigravity Enhance Tools (Antigravity 扩展增强工具)",
                FontSize = 13,
                FontWeight = FontWeights.SemiBold,
                VerticalAlignment = VerticalAlignment.Center
            };
            titleLeft.Children.Add(titleText);

            verBadge = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(6),
                Padding = new Thickness(7, 2, 7, 2),
                Margin = new Thickness(10, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            verBadgeText = new TextBlock
            {
                Text = "v0.1.5",
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
                Margin = new Thickness(0, 0, 14, 0)
            };

            btnAbout = new Button
            {
                Content = "ℹ️ 关于",
                Height = 28,
                Padding = new Thickness(8, 0, 8, 0),
                Margin = new Thickness(0, 0, 8, 0),
                FontSize = 11,
                Cursor = Cursors.Hand,
                VerticalAlignment = VerticalAlignment.Center
            };
            btnAbout.Click += (s, e) => ShowAboutDialog();
            titleRight.Children.Add(btnAbout);

            btnTheme = new Button
            {
                Height = 28,
                Padding = new Thickness(10, 0, 10, 0),
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
                Margin = new Thickness(20, 10, 20, 10)
            };

            // Banner Card
            bannerBorder = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(12),
                Padding = new Thickness(16, 12, 16, 12),
                Margin = new Thickness(0, 0, 0, 14)
            };

            var bannerGrid = new Grid();
            bannerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(48) });
            bannerGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            if (iconImage != null)
            {
                var bannerLogo = new Image
                {
                    Source = iconImage,
                    Width = 38,
                    Height = 38,
                    HorizontalAlignment = HorizontalAlignment.Left,
                    VerticalAlignment = VerticalAlignment.Center,
                    Effect = new DropShadowEffect
                    {
                        Color = Color.FromRgb(59, 130, 246),
                        BlurRadius = 10,
                        Opacity = 0.35,
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
                Text = "Antigravity Enhance Tools (Antigravity 扩展增强工具)",
                FontSize = 14.5,
                FontWeight = FontWeights.Bold
            };
            bannerSubtitle = new TextBlock
            {
                Text = "全界面原生深度汉化 · 动态上下文实时遥测 · 4 挡思考调节滑块 · 额度看板 · 防卡死守护",
                FontSize = 11,
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
                FontSize = 12,
                FontWeight = FontWeights.SemiBold,
                Margin = new Thickness(2, 0, 0, 6)
            };
            bodyStack.Children.Add(pathHeader);

            var pathRow = new Grid { Margin = new Thickness(0, 0, 0, 4) };
            pathRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            pathRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(108) });
            pathRow.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(88) });

            pathBoxBorder = new Border
            {
                Height = 36,
                CornerRadius = new CornerRadius(8),
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

            btnAutoSearch = CreateStyledButton("🔍 自动搜索", new CornerRadius(8), 36, new Thickness(8, 0, 8, 0));
            btnAutoSearch.Margin = new Thickness(8, 0, 0, 0);
            btnAutoSearch.ToolTip = "深度检索系统运行进程、默认安装目录与注册表";
            btnAutoSearch.Click += (s, e) =>
            {
                lblPathStatus.Text = "🔍 正在全盘深度检索客户端安装目录与运行进程...";
                lblPathStatus.Foreground = new SolidColorBrush(isDarkMode ? Color.FromRgb(147, 197, 253) : Color.FromRgb(37, 99, 235));
                DetectPath(true);
            };
            Grid.SetColumn(btnAutoSearch, 1);
            pathRow.Children.Add(btnAutoSearch);

            btnBrowse = CreateStyledButton("📁 浏览...", new CornerRadius(8), 36, new Thickness(12, 0, 12, 0));
            btnBrowse.Margin = new Thickness(8, 0, 0, 0);
            btnBrowse.ToolTip = "手动选择 Antigravity.exe 或 resources 目录";
            btnBrowse.Click += BtnBrowse_Click;
            Grid.SetColumn(btnBrowse, 2);
            pathRow.Children.Add(btnBrowse);
            bodyStack.Children.Add(pathRow);

            lblPathStatus = new TextBlock
            {
                Text = "正在检测客户端安装目录...",
                FontSize = 11,
                Margin = new Thickness(2, 0, 0, 10)
            };
            bodyStack.Children.Add(lblPathStatus);

            // Enhancement Features Chips (2-column layout)
            var featuresWrap = new UniformGrid
            {
                Columns = 2,
                Margin = new Thickness(0, 0, 0, 10)
            };
            featuresWrap.Children.Add(AddFeatureChip("🌐 全界面原生深度汉化", "全量覆盖核心菜单、会话视窗与系统设置"));
            featuresWrap.Children.Add(AddFeatureChip("📈 动态上下文实时遥测", "会话级消耗毫秒同步，自适应模型上限"));
            featuresWrap.Children.Add(AddFeatureChip("🧠 思考能力 4 挡调节滑块", "模型思维链深度绑定，平滑阻尼调节"));
            featuresWrap.Children.Add(AddFeatureChip("📊 实时额度与用量看板", "支持 Gemini / Claude 额度轮询遥测"));
            featuresWrap.Children.Add(AddFeatureChip("✨ 现代视效与原生沉浸交互", "重构品牌视效体系，深度适配沉浸式交互流"));
            featuresWrap.Children.Add(AddFeatureChip("🛡️ 防卡死单主控守卫", "DOM 变化防抖节流，杜绝界面卡顿死循环"));
            bodyStack.Children.Add(featuresWrap);

            // Progress Bar & Status Text
            lblStatus = new TextBlock
            {
                Text = "就绪状态：可点击下方按钮一键安装或还原官方版。",
                FontSize = 11.5,
                FontWeight = FontWeights.Medium,
                Margin = new Thickness(2, 0, 0, 6)
            };
            bodyStack.Children.Add(lblStatus);

            progressBar = new ProgressBar
            {
                Height = 4,
                BorderThickness = new Thickness(0),
                Value = 0,
                Maximum = 100,
                Margin = new Thickness(0, 0, 0, 8)
            };
            bodyStack.Children.Add(progressBar);

            // Live Log Console Box inside Border
            logBorder = new Border
            {
                Height = 88,
                CornerRadius = new CornerRadius(8),
                BorderThickness = new Thickness(1),
                Padding = new Thickness(8, 6, 8, 6)
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
                Background = Brushes.Transparent, // Transparent so rootBorder bottom rounded corners are preserved
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

            btnRestore = CreateStyledButton("↺ 一键还原官方原版", new CornerRadius(8), 38, new Thickness(16, 0, 16, 0), false);
            btnRestore.Margin = new Thickness(0, 0, 10, 0);
            btnRestore.Click += BtnRestore_Click;
            buttonStack.Children.Add(btnRestore);

            btnInstall = CreateStyledButton(
                "🚀 一键安装 / 更新增强补丁",
                new CornerRadius(8),
                38,
                new Thickness(20, 0, 20, 0),
                true
            );
            btnInstall.Click += BtnInstall_Click;
            buttonStack.Children.Add(btnInstall);

            Grid.SetColumn(buttonStack, 1);
            bottomGrid.Children.Add(buttonStack);

            Grid.SetRow(bottomGrid, 2);
            mainGrid.Children.Add(bottomGrid);

            // ================= 4. Modern Footer (Model, Author, GitHub & About) =================
            footerBorder = new Border
            {
                BorderThickness = new Thickness(0, 1, 0, 0),
                Padding = new Thickness(18, 9, 18, 11),
                Margin = new Thickness(0)
            };

            var footerStack = new StackPanel();

            // 3-Card Row
            var cardsGrid = new UniformGrid
            {
                Columns = 3,
                Margin = new Thickness(0, 0, 0, 7)
            };

            // Card 1: Author (Display personal avatar)
            UIElement authorIconEl = null;
            var avatarBmp = LoadEmbeddedImage("author_avatar.png");
            if (avatarBmp != null)
            {
                var img = new Image
                {
                    Source = avatarBmp,
                    Width = 24,
                    Height = 24,
                    Stretch = Stretch.UniformToFill,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center
                };
                img.Clip = new EllipseGeometry(new Point(12, 12), 12, 12);
                authorIconEl = img;
            }
            cardAuthor = CreateFooterCard("👤", "作者 (Author)", "Kutaze", Color.FromRgb(59, 130, 246), out lblAuthorTitle, out lblAuthorVal, authorIconEl);
            cardAuthor.Cursor = Cursors.Hand;
            cardAuthor.ToolTip = "点击访问作者 GitHub 个人主页";
            cardAuthor.MouseLeftButtonUp += (s, e) => OpenUrl("https://github.com/Kutaze");
            cardsGrid.Children.Add(cardAuthor);

            // Card 2: Software Model
            cardModel = CreateFooterCard("🏷️", "软件型号 (Model)", "v0.1.5 Enhance Pro", Color.FromRgb(16, 185, 129), out lblModelTitle, out lblModelVal);
            cardModel.Cursor = Cursors.Hand;
            cardModel.ToolTip = "Antigravity 原生深度增强与多账号管理套件 (点击查看关于信息)";
            cardModel.MouseLeftButtonUp += (s, e) => ShowAboutDialog();
            cardsGrid.Children.Add(cardModel);

            // Card 3: GitHub (Lobe Icons vector GitHub logo)
            pathGithubLogo = new System.Windows.Shapes.Path
            {
                Width = 15,
                Height = 15,
                Stretch = Stretch.Uniform,
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                Data = Geometry.Parse("M12 0c6.63 0 12 5.276 12 11.79-.001 5.067-3.29 9.567-8.175 11.187-.6.118-.825-.25-.825-.56 0-.398.015-1.665.015-3.242 0-1.105-.375-1.813-.81-2.181 2.67-.295 5.475-1.297 5.475-5.822 0-1.297-.465-2.344-1.23-3.169.12-.295.54-1.503-.12-3.125 0 0-1.005-.324-3.3 1.209a11.32 11.32 0 00-3-.398c-1.02 0-2.04.133-3 .398-2.295-1.518-3.3-1.209-3.3-1.209-.66 1.622-.24 2.83-.12 3.125-.765.825-1.23 1.887-1.23 3.169 0 4.51 2.79 5.527 5.46 5.822-.345.294-.66.81-.765 1.577-.69.31-2.415.81-3.495-.973-.225-.354-.9-1.223-1.845-1.209-1.005.015-.405.56.015.781.51.28 1.095 1.327 1.23 1.666.24.663 1.02 1.93 4.035 1.385 0 .988.015 1.916.015 2.196 0 .31-.225.664-.825.56C3.303 21.374-.003 16.867 0 11.791 0 5.276 5.37 0 12 0z"),
                Fill = new SolidColorBrush(Color.FromRgb(168, 85, 247))
            };
            cardGithub = CreateFooterCard("", "开源地址 (GitHub)", "View Code ↗", Color.FromRgb(139, 92, 246), out lblGithubTitle, out lblGithubVal, pathGithubLogo);
            cardGithub.Cursor = Cursors.Hand;
            cardGithub.ToolTip = "点击在浏览器中打开 GitHub 开源仓库主页 (Logo 来源: lobehub/lobe-icons)";
            cardGithub.MouseLeftButtonUp += (s, e) => OpenUrl("https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools");
            cardsGrid.Children.Add(cardGithub);

            footerStack.Children.Add(cardsGrid);

            // Badges & Copyright Row
            var metaStack = new Grid();
            metaStack.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            metaStack.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            var badgesRow = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                VerticalAlignment = VerticalAlignment.Center
            };
            badgesRow.Children.Add(CreateFooterBadge("C# 5.0 / WPF"));
            badgesRow.Children.Add(CreateFooterBadge("Electron AST"));
            badgesRow.Children.Add(CreateFooterBadge("100% 本地凭据安全"));
            badgesRow.Children.Add(CreateFooterBadge("MIT License"));
            Grid.SetColumn(badgesRow, 0);
            metaStack.Children.Add(badgesRow);

            lblCopyright = new TextBlock
            {
                Text = "Copyright © 2026 Antigravity Enhance Tools · Kutaze",
                FontSize = 10,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(lblCopyright, 1);
            metaStack.Children.Add(lblCopyright);

            footerStack.Children.Add(metaStack);
            footerBorder.Child = footerStack;

            Grid.SetRow(footerBorder, 3);
            mainGrid.Children.Add(footerBorder);

            rootBorder.Child = mainGrid;
            windowContainer.Children.Add(rootBorder);
            Content = windowContainer;
        }

        public void ApplyTheme(bool dark)
        {
            isDarkMode = dark;

            if (dark)
            {
                // Dark Theme Palette (Sleek Modern Obsidian / Slate)
                rootBorder.Background = new SolidColorBrush(Color.FromRgb(15, 23, 42)); // Slate 900
                rootBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)); // Slate 700
                rootBorder.Effect = new DropShadowEffect
                {
                    Color = Colors.Black,
                    Direction = 270,
                    ShadowDepth = 6,
                    BlurRadius = 24,
                    Opacity = 0.55
                };

                titleText.Foreground = new SolidColorBrush(Color.FromRgb(248, 250, 252));

                verBadge.Background = new SolidColorBrush(Color.FromArgb(40, 59, 130, 246));
                verBadge.BorderBrush = new SolidColorBrush(Color.FromArgb(90, 59, 130, 246));
                verBadgeText.Foreground = new SolidColorBrush(Color.FromRgb(147, 197, 253));

                btnTheme.Content = "☀️ 浅色模式";
                UpdateButtonStyle(btnTheme,
                    new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                    new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                    new CornerRadius(6),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)));

                UpdateWindowButtonStyle(btnMin, false, true);
                UpdateWindowButtonStyle(btnClose, true, true);

                bannerBorder.Background = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                bannerBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85));
                bannerTitle.Foreground = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                bannerSubtitle.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));

                pathHeader.Foreground = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                pathBoxBorder.Background = new SolidColorBrush(Color.FromRgb(15, 23, 42));
                pathBoxBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85));
                txtPath.Foreground = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                txtPath.CaretBrush = Brushes.White;

                UpdateButtonStyle(btnAutoSearch,
                    new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                    new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)));

                UpdateButtonStyle(btnBrowse,
                    new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                    new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)));

                foreach (var chip in featureChips)
                {
                    chip.Border.Background = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                    chip.Border.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85));
                    chip.TitleBlock.Foreground = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                    chip.DescBlock.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));
                }

                lblStatus.Foreground = new SolidColorBrush(Color.FromRgb(203, 213, 225));
                progressBar.Background = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                progressBar.Foreground = new SolidColorBrush(Color.FromRgb(59, 130, 246)); // Clean modern blue

                logBorder.Background = new SolidColorBrush(Color.FromRgb(10, 15, 30));
                logBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                txtLog.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));

                chkAutoLaunch.Foreground = new SolidColorBrush(Color.FromRgb(203, 213, 225));
                UpdateCheckBoxStyle(chkAutoLaunch, true);

                UpdateButtonStyle(btnRestore,
                    new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                    new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)));

                // Minimalist, sleek, modern accent button (clean tech blue, not oversaturated neon)
                UpdateButtonStyle(btnInstall,
                    new SolidColorBrush(Color.FromRgb(37, 99, 235)), // Blue 600
                    Brushes.White,
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(37, 99, 235)));
                btnInstall.Effect = new DropShadowEffect
                {
                    Color = Color.FromRgb(37, 99, 235),
                    BlurRadius = 10,
                    Opacity = 0.28,
                    ShadowDepth = 1
                };

                // Footer & About Cards (Dark Theme)
                if (footerBorder != null)
                {
                    footerBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85));

                    var cardBgDark = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                    var cardBorderDark = new SolidColorBrush(Color.FromRgb(51, 65, 85));
                    var textMutedDark = new SolidColorBrush(Color.FromRgb(148, 163, 184));
                    var textValDark = new SolidColorBrush(Color.FromRgb(248, 250, 252));

                    cardAuthor.Background = cardBgDark;
                    cardAuthor.BorderBrush = cardBorderDark;
                    lblAuthorTitle.Foreground = textMutedDark;
                    lblAuthorVal.Foreground = textValDark;

                    cardModel.Background = cardBgDark;
                    cardModel.BorderBrush = cardBorderDark;
                    lblModelTitle.Foreground = textMutedDark;
                    lblModelVal.Foreground = textValDark;

                    cardGithub.Background = cardBgDark;
                    cardGithub.BorderBrush = cardBorderDark;
                    lblGithubTitle.Foreground = textMutedDark;
                    lblGithubVal.Foreground = new SolidColorBrush(Color.FromRgb(96, 165, 250)); // Blue 400
                    if (pathGithubLogo != null)
                    {
                        pathGithubLogo.Fill = new SolidColorBrush(Color.FromRgb(192, 132, 252));
                    }

                    foreach (var b in footerBadges)
                    {
                        b.Background = new SolidColorBrush(Color.FromRgb(15, 23, 42));
                        b.BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85));
                    }
                    foreach (var tb in footerBadgeTexts)
                    {
                        tb.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));
                    }

                    lblCopyright.Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139));
                }

                if (btnAbout != null)
                {
                    btnAbout.Content = "ℹ️ 关于";
                    UpdateButtonStyle(btnAbout,
                        new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                        new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                        new CornerRadius(6),
                        new SolidColorBrush(Color.FromRgb(51, 65, 85)));
                }
            }
            else
            {
                // Light Theme Palette (Minimalist, Crisp, Apple / Linear Neutral)
                rootBorder.Background = new SolidColorBrush(Color.FromRgb(255, 255, 255)); // Pure White
                rootBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)); // Slate 200
                rootBorder.Effect = new DropShadowEffect
                {
                    Color = Color.FromRgb(100, 116, 139),
                    Direction = 270,
                    ShadowDepth = 5,
                    BlurRadius = 22,
                    Opacity = 0.20
                };

                titleText.Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)); // Slate 900

                verBadge.Background = new SolidColorBrush(Color.FromRgb(241, 245, 249)); // Slate 100
                verBadge.BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225)); // Slate 300
                verBadgeText.Foreground = new SolidColorBrush(Color.FromRgb(71, 85, 105)); // Slate 600

                btnTheme.Content = "🌙 深色模式";
                UpdateButtonStyle(btnTheme,
                    new SolidColorBrush(Color.FromRgb(248, 250, 252)),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new CornerRadius(6),
                    new SolidColorBrush(Color.FromRgb(226, 232, 240)));

                UpdateWindowButtonStyle(btnMin, false, false);
                UpdateWindowButtonStyle(btnClose, true, false);

                bannerBorder.Background = new SolidColorBrush(Color.FromRgb(248, 250, 252)); // Slate 50
                bannerBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)); // Slate 200
                bannerTitle.Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42)); // Slate 900
                bannerSubtitle.Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)); // Slate 500

                pathHeader.Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                pathBoxBorder.Background = new SolidColorBrush(Color.FromRgb(255, 255, 255));
                pathBoxBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225));
                txtPath.Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42));
                txtPath.CaretBrush = Brushes.Black;

                UpdateButtonStyle(btnAutoSearch,
                    new SolidColorBrush(Color.FromRgb(248, 250, 252)),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(203, 213, 225)));

                UpdateButtonStyle(btnBrowse,
                    new SolidColorBrush(Color.FromRgb(248, 250, 252)),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(203, 213, 225)));

                foreach (var chip in featureChips)
                {
                    chip.Border.Background = new SolidColorBrush(Color.FromRgb(255, 255, 255));
                    chip.Border.BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                    chip.TitleBlock.Foreground = new SolidColorBrush(Color.FromRgb(15, 23, 42));
                    chip.DescBlock.Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139));
                }

                lblStatus.Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59));
                progressBar.Background = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                progressBar.Foreground = new SolidColorBrush(Color.FromRgb(37, 99, 235)); // Modern Blue 600

                logBorder.Background = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                logBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                txtLog.Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85));

                chkAutoLaunch.Foreground = new SolidColorBrush(Color.FromRgb(51, 65, 85));
                UpdateCheckBoxStyle(chkAutoLaunch, false);

                UpdateButtonStyle(btnRestore,
                    new SolidColorBrush(Color.FromRgb(255, 255, 255)),
                    new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(203, 213, 225)));

                // Minimalist Obsidian primary button: clean, low saturation, high-end Apple / Vercel style
                UpdateButtonStyle(btnInstall,
                    new SolidColorBrush(Color.FromRgb(15, 23, 42)), // Slate 900
                    Brushes.White,
                    new CornerRadius(8),
                    new SolidColorBrush(Color.FromRgb(15, 23, 42)));
                btnInstall.Effect = new DropShadowEffect
                {
                    Color = Color.FromRgb(15, 23, 42),
                    BlurRadius = 8,
                    Opacity = 0.16,
                    ShadowDepth = 1
                };

                // Footer & About Cards (Light Theme)
                if (footerBorder != null)
                {
                    footerBorder.BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240));

                    var cardBgLight = new SolidColorBrush(Color.FromRgb(248, 250, 252));
                    var cardBorderLight = new SolidColorBrush(Color.FromRgb(226, 232, 240));
                    var textMutedLight = new SolidColorBrush(Color.FromRgb(100, 116, 139));
                    var textValLight = new SolidColorBrush(Color.FromRgb(15, 23, 42));

                    cardAuthor.Background = cardBgLight;
                    cardAuthor.BorderBrush = cardBorderLight;
                    lblAuthorTitle.Foreground = textMutedLight;
                    lblAuthorVal.Foreground = textValLight;

                    cardModel.Background = cardBgLight;
                    cardModel.BorderBrush = cardBorderLight;
                    lblModelTitle.Foreground = textMutedLight;
                    lblModelVal.Foreground = textValLight;

                    cardGithub.Background = cardBgLight;
                    cardGithub.BorderBrush = cardBorderLight;
                    lblGithubTitle.Foreground = textMutedLight;
                    lblGithubVal.Foreground = new SolidColorBrush(Color.FromRgb(37, 99, 235)); // Blue 600
                    if (pathGithubLogo != null)
                    {
                        pathGithubLogo.Fill = new SolidColorBrush(Color.FromRgb(124, 58, 237));
                    }

                    foreach (var b in footerBadges)
                    {
                        b.Background = new SolidColorBrush(Color.FromRgb(241, 245, 249));
                        b.BorderBrush = new SolidColorBrush(Color.FromRgb(203, 213, 225));
                    }
                    foreach (var tb in footerBadgeTexts)
                    {
                        tb.Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139));
                    }

                    lblCopyright.Foreground = new SolidColorBrush(Color.FromRgb(148, 163, 184));
                }

                if (btnAbout != null)
                {
                    btnAbout.Content = "ℹ️ 关于";
                    UpdateButtonStyle(btnAbout,
                        new SolidColorBrush(Color.FromRgb(248, 250, 252)),
                        new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                        new CornerRadius(6),
                        new SolidColorBrush(Color.FromRgb(226, 232, 240)));
                }
            }

            ValidatePath();
        }

        private void UpdateButtonStyle(Button btn, Brush bg, Brush fg, CornerRadius radius, Brush borderBrush = null)
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
            borderFactory.SetValue(Border.BorderBrushProperty, borderBrush ?? (isDarkMode
                ? new SolidColorBrush(Color.FromArgb(60, 255, 255, 255))
                : new SolidColorBrush(Color.FromRgb(203, 213, 225))));

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
            disabledTrigger.Setters.Add(new Setter(Button.OpacityProperty, 0.38));
            template.Triggers.Add(disabledTrigger);

            btn.Template = template;
        }

        private void UpdateCheckBoxStyle(CheckBox chk, bool isDark)
        {
            var template = new ControlTemplate(typeof(CheckBox));
            var stack = new FrameworkElementFactory(typeof(StackPanel));
            stack.SetValue(StackPanel.OrientationProperty, Orientation.Horizontal);
            stack.SetValue(StackPanel.VerticalAlignmentProperty, VerticalAlignment.Center);

            // Modern Rounded Checkbox Box
            var boxBorder = new FrameworkElementFactory(typeof(Border));
            boxBorder.Name = "checkBorder";
            boxBorder.SetValue(Border.WidthProperty, 17.0);
            boxBorder.SetValue(Border.HeightProperty, 17.0);
            boxBorder.SetValue(Border.CornerRadiusProperty, new CornerRadius(4.5));
            boxBorder.SetValue(Border.BorderThicknessProperty, new Thickness(1.5));
            boxBorder.SetValue(Border.BackgroundProperty, isDark
                ? new SolidColorBrush(Color.FromRgb(15, 23, 42))
                : Brushes.White);
            boxBorder.SetValue(Border.BorderBrushProperty, isDark
                ? new SolidColorBrush(Color.FromRgb(71, 85, 105))
                : new SolidColorBrush(Color.FromRgb(203, 213, 225)));
            boxBorder.SetValue(Border.SnapsToDevicePixelsProperty, true);

            // Modern Rounded Checkmark Vector Icon (Perfect Center & Golden Ratio)
            var checkPath = new FrameworkElementFactory(typeof(System.Windows.Shapes.Path));
            checkPath.Name = "checkMark";
            checkPath.SetValue(System.Windows.Shapes.Path.DataProperty, Geometry.Parse("M 1.5,5.5 L 4.5,8.5 L 10.5,1.5"));
            checkPath.SetValue(System.Windows.Shapes.Path.WidthProperty, 9.5);
            checkPath.SetValue(System.Windows.Shapes.Path.HeightProperty, 7.5);
            checkPath.SetValue(System.Windows.Shapes.Path.StretchProperty, Stretch.Uniform);
            checkPath.SetValue(System.Windows.Shapes.Path.StrokeProperty, Brushes.White);
            checkPath.SetValue(System.Windows.Shapes.Path.StrokeThicknessProperty, 1.8);
            checkPath.SetValue(System.Windows.Shapes.Path.StrokeStartLineCapProperty, PenLineCap.Round);
            checkPath.SetValue(System.Windows.Shapes.Path.StrokeEndLineCapProperty, PenLineCap.Round);
            checkPath.SetValue(System.Windows.Shapes.Path.StrokeLineJoinProperty, PenLineJoin.Round);
            checkPath.SetValue(System.Windows.Shapes.Path.VisibilityProperty, Visibility.Collapsed);
            checkPath.SetValue(System.Windows.Shapes.Path.HorizontalAlignmentProperty, HorizontalAlignment.Center);
            checkPath.SetValue(System.Windows.Shapes.Path.VerticalAlignmentProperty, VerticalAlignment.Center);

            boxBorder.AppendChild(checkPath);
            stack.AppendChild(boxBorder);

            // Text Label Presenter
            var content = new FrameworkElementFactory(typeof(ContentPresenter));
            content.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
            content.SetValue(ContentPresenter.MarginProperty, new Thickness(8, 0, 0, 0));
            content.SetValue(ContentPresenter.RecognizesAccessKeyProperty, true);
            stack.AppendChild(content);

            template.VisualTree = stack;

            // Trigger: Checked state
            var checkedTrigger = new Trigger { Property = CheckBox.IsCheckedProperty, Value = true };
            checkedTrigger.Setters.Add(new Setter(Border.BackgroundProperty, isDark
                ? new SolidColorBrush(Color.FromRgb(37, 99, 235))
                : new SolidColorBrush(Color.FromRgb(15, 23, 42)), "checkBorder"));
            checkedTrigger.Setters.Add(new Setter(Border.BorderBrushProperty, isDark
                ? new SolidColorBrush(Color.FromRgb(37, 99, 235))
                : new SolidColorBrush(Color.FromRgb(15, 23, 42)), "checkBorder"));
            checkedTrigger.Setters.Add(new Setter(System.Windows.Shapes.Path.VisibilityProperty, Visibility.Visible, "checkMark"));
            template.Triggers.Add(checkedTrigger);

            // Trigger: Mouse hover state
            var hoverTrigger = new Trigger { Property = CheckBox.IsMouseOverProperty, Value = true };
            hoverTrigger.Setters.Add(new Setter(Border.BorderBrushProperty, isDark
                ? new SolidColorBrush(Color.FromRgb(96, 165, 250))
                : new SolidColorBrush(Color.FromRgb(71, 85, 105)), "checkBorder"));
            template.Triggers.Add(hoverTrigger);

            chk.Template = template;
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
            borderFactory.SetValue(Border.CornerRadiusProperty, new CornerRadius(6));

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
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(12, 8, 12, 8),
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

        private Border CreateFooterCard(string icon, string title, string val, Color iconAccent, out TextBlock tbTitle, out TextBlock tbVal, UIElement customIcon = null)
        {
            var b = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(10),
                Padding = new Thickness(10, 7, 10, 7),
                Margin = new Thickness(4, 0, 4, 0)
            };

            var g = new Grid();
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(32) });
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });

            var iconBorder = new Border
            {
                Width = 28,
                Height = 28,
                CornerRadius = (customIcon is Border) ? new CornerRadius(14) : new CornerRadius(7),
                Background = new SolidColorBrush(Color.FromArgb(32, iconAccent.R, iconAccent.G, iconAccent.B)),
                BorderBrush = new SolidColorBrush(Color.FromArgb(64, iconAccent.R, iconAccent.G, iconAccent.B)),
                BorderThickness = new Thickness(1),
                VerticalAlignment = VerticalAlignment.Center,
                HorizontalAlignment = HorizontalAlignment.Left
            };
            if (customIcon != null)
            {
                iconBorder.Child = customIcon;
            }
            else
            {
                var tbIcon = new TextBlock
                {
                    Text = icon,
                    FontSize = 13.5,
                    HorizontalAlignment = HorizontalAlignment.Center,
                    VerticalAlignment = VerticalAlignment.Center,
                    FontFamily = new FontFamily("Segoe UI Emoji, Segoe UI")
                };
                iconBorder.Child = tbIcon;
            }
            Grid.SetColumn(iconBorder, 0);
            g.Children.Add(iconBorder);

            var s = new StackPanel
            {
                VerticalAlignment = VerticalAlignment.Center,
                Margin = new Thickness(4, 0, 0, 0)
            };
            tbTitle = new TextBlock
            {
                Text = title,
                FontSize = 10.5,
                Margin = new Thickness(0, 0, 0, 1)
            };
            tbVal = new TextBlock
            {
                Text = val,
                FontSize = 12,
                FontWeight = FontWeights.SemiBold
            };
            s.Children.Add(tbTitle);
            s.Children.Add(tbVal);
            Grid.SetColumn(s, 1);
            g.Children.Add(s);

            b.Child = g;

            b.MouseEnter += (s1, e1) => { b.Opacity = 0.85; };
            b.MouseLeave += (s1, e1) => { b.Opacity = 1.0; };

            return b;
        }

        private Border CreateFooterBadge(string text)
        {
            var b = new Border
            {
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(5, 1.5, 5, 1.5),
                Margin = new Thickness(0, 0, 6, 0)
            };
            var tb = new TextBlock
            {
                Text = text,
                FontSize = 9.5,
                FontWeight = FontWeights.Medium
            };
            b.Child = tb;
            footerBadges.Add(b);
            footerBadgeTexts.Add(tb);
            return b;
        }

        private void OpenUrl(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch (Exception ex)
            {
                MessageBox.Show("无法打开链接: " + ex.Message, "提示", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        private void ShowAboutDialog()
        {
            MessageBox.Show(
                "Antigravity Enhance Tools (Antigravity 扩展增强工具)\n\n" +
                "软件型号：v0.1.5 Enhance Pro (全原生 AST 响应式注入)\n" +
                "作者：Kutaze\n" +
                "开源项目主页：https://github.com/Kutaze/Antigravity-Enhance-Pack-Tools\n\n" +
                "核心能力：\n" +
                "• 全界面母语级原生深度汉化与防卡死守卫\n" +
                "• 多账号快捷切换与配额监控 (100% 本地凭据库存储，绝无云端中转)\n" +
                "• 真实上下文 Token 动态遥测与 5 段式占比面板\n" +
                "• 4 挡思考深度滑动调节与原生截图集成\n\n" +
                "特别鸣谢：\n" +
                "• 界面 GitHub 矢量图标参考自开源项目 lobehub/lobe-icons\n\n" +
                "Copyright © 2025-2026 Antigravity Enhance Tools · Kutaze",
                "关于软件 - Antigravity Enhance Tools",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
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
                if (resourceName == "icon.png" && !string.IsNullOrEmpty(CustomLogoPath) && File.Exists(CustomLogoPath))
                {
                    using (var fs = File.OpenRead(CustomLogoPath))
                    {
                        var customImg = new BitmapImage();
                        customImg.BeginInit();
                        customImg.StreamSource = fs;
                        customImg.CacheOption = BitmapCacheOption.OnLoad;
                        customImg.EndInit();
                        customImg.Freeze();
                        return customImg;
                    }
                }

                var asm = Assembly.GetExecutingAssembly();
                using (var stream = asm.GetManifestResourceStream(resourceName))
                {
                    if (stream != null)
                    {
                        var img = new BitmapImage();
                        img.BeginInit();
                        img.StreamSource = stream;
                        img.CacheOption = BitmapCacheOption.OnLoad;
                        img.EndInit();
                        img.Freeze();
                        return img;
                    }
                }

                // Fallback to local assets folder
                string localAsset = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets", resourceName);
                if (!File.Exists(localAsset))
                {
                    localAsset = Path.Combine(@"D:\desk\Antigravity\Antigravity-Enhance-Pack\assets", resourceName);
                }
                if (File.Exists(localAsset))
                {
                    using (var fs = File.OpenRead(localAsset))
                    {
                        var localImg = new BitmapImage();
                        localImg.BeginInit();
                        localImg.StreamSource = fs;
                        localImg.CacheOption = BitmapCacheOption.OnLoad;
                        localImg.EndInit();
                        localImg.Freeze();
                        return localImg;
                    }
                }
            }
            catch (Exception ex)
            {
                try { File.AppendAllText(@"C:\Users\Lynan\.gemini\antigravity\scratch\img_err.log", resourceName + ": " + ex.ToString() + "\n"); } catch { }
            }
            return null;
        }

        private void DetectPath(bool isManual = false)
        {
            var checkedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // 1. Detect from active running processes
            try
            {
                var procs = Process.GetProcessesByName("Antigravity");
                if (procs != null && procs.Length > 0)
                {
                    foreach (var proc in procs)
                    {
                        try
                        {
                            string procPath = proc.MainModule.FileName;
                            string dir = Path.GetDirectoryName(procPath);
                            if (File.Exists(Path.Combine(dir, "resources", "app.asar")))
                            {
                                detectedInstallDir = dir;
                                txtPath.Text = dir;
                                Log((isManual ? "✔ [手动检索] " : "✔ [自动识别] ") + "已定位当前运行中的客户端: " + dir);
                                ValidatePath();
                                return;
                            }
                        }
                        catch { }
                    }
                }
            }
            catch { }

            // 2. Candidate folders
            var candidates = new List<string>
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs", "antigravity"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Antigravity"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Antigravity"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Programs", "antigravity"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "AppData", "Local", "Programs", "antigravity"),
                @"C:\Users\Lynan\AppData\Local\Programs\antigravity"
            };

            // 3. Registry Uninstall Entries
            try
            {
                string[] regRoots = new string[]
                {
                    @"Software\Microsoft\Windows\CurrentVersion\Uninstall",
                    @"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
                };

                foreach (var regRoot in regRoots)
                {
                    using (var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(regRoot))
                    {
                        if (key != null)
                        {
                            foreach (var subKeyName in key.GetSubKeyNames())
                            {
                                using (var subKey = key.OpenSubKey(subKeyName))
                                {
                                    if (subKey != null)
                                    {
                                        var disp = subKey.GetValue("DisplayName") as string;
                                        if (!string.IsNullOrEmpty(disp) && disp.IndexOf("Antigravity", StringComparison.OrdinalIgnoreCase) >= 0)
                                        {
                                            var loc = subKey.GetValue("InstallLocation") as string;
                                            if (!string.IsNullOrEmpty(loc)) candidates.Add(loc);
                                            var icon = subKey.GetValue("DisplayIcon") as string;
                                            if (!string.IsNullOrEmpty(icon))
                                            {
                                                string iconDir = Path.GetDirectoryName(icon.Trim('\"', ' '));
                                                if (!string.IsNullOrEmpty(iconDir)) candidates.Add(iconDir);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            catch { }

            foreach (var c in candidates)
            {
                if (string.IsNullOrEmpty(c) || checkedPaths.Contains(c)) continue;
                checkedPaths.Add(c);

                if (File.Exists(Path.Combine(c, "resources", "app.asar")))
                {
                    detectedInstallDir = c;
                    txtPath.Text = c;
                    Log((isManual ? "✔ [手动检索] " : "✔ [自动识别] ") + "已定位 Antigravity 客户端目录: " + c);
                    ValidatePath();
                    return;
                }
            }

            if (isManual)
            {
                Log("⚠ 未能自动检索到客户端目录，请点击“浏览”手动指定 Antigravity 安装目录。");
            }
            else
            {
                Log("未自动定位到默认目录，等待用户指定或点击“自动搜索”。");
            }
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
                lblPathStatus.Text = "▲ 未在该目录下找到 resources/app.asar，请确认所选目录为 Antigravity 安装根目录。";
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
            btnAutoSearch.IsEnabled = !working;
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
                        lblStatus.Text = "步骤 4/5: 正在执行汉化注入与防卡死守护封包...";
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

                    using (var proc = Process.Start(psi))
                    {
                        proc.OutputDataReceived += (s, args) =>
                        {
                            if (!string.IsNullOrEmpty(args.Data))
                            {
                                Dispatcher.Invoke(() => Log(args.Data));
                            }
                        };
                        proc.ErrorDataReceived += (s, args) =>
                        {
                            if (!string.IsNullOrEmpty(args.Data))
                            {
                                Dispatcher.Invoke(() => Log("[ERR] " + args.Data));
                            }
                        };

                        proc.BeginOutputReadLine();
                        proc.BeginErrorReadLine();
                        proc.WaitForExit();

                        if (proc.ExitCode != 0)
                        {
                            throw new Exception("补丁注入脚本执行失败，退出代码: " + proc.ExitCode);
                        }
                    }

                    // Step 5: Finished
                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 100;
                        lblStatus.Text = "🎉 安装完成！Antigravity 深度汉化与原生 UI 增强补丁已生效。";
                        Log("==========================================");
                        Log("✔ 增强与汉化补丁全部部署成功！");

                        if (autoLaunch)
                        {
                            string exePath = Path.Combine(installDir, "Antigravity.exe");
                            if (File.Exists(exePath))
                            {
                                Process.Start(new ProcessStartInfo(exePath) { UseShellExecute = true });
                                Log("已为您自动启动 Antigravity 客户端。");
                            }
                        }

                        MessageBox.Show(
                            "🎉 Antigravity 深度汉化与原生 UI 交互增强补丁安装成功！\n\n已具备：\n• 全界面原生深度汉化\n• 真实上下文实时动态监测\n• 思考能力 4 挡滑块调节\n• 实时额度与消耗看板\n• 防死循环与防卡死主控引擎",
                            "安装成功 - Antigravity Enhance Tools",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    });
                }
                catch (Exception ex)
                {
                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 0;
                        lblStatus.Text = "❌ 安装失败：" + ex.Message;
                        Log("❌ [错误] " + ex.Message);
                        MessageBox.Show("安装过程中发生错误：\n" + ex.Message, "安装失败", MessageBoxButton.OK, MessageBoxImage.Error);
                    });
                }
                finally
                {
                    try { if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true); } catch { }
                    Dispatcher.Invoke(() => SetWorking(false, lblStatus.Text));
                }
            });
        }

        private void BtnRestore_Click(object sender, RoutedEventArgs e)
        {
            if (!ValidatePath()) return;
            string installDir = detectedInstallDir;

            var result = MessageBox.Show(
                "确定要还原 Antigravity 官方原版吗？\n这将恢复官方 app.asar 并还原默认英文界面与原生设置。",
                "确认还原官方原版",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result != MessageBoxResult.Yes) return;

            SetWorking(true, "正在准备还原官方原版...");
            progressBar.Value = 10;
            Log("==========================================");
            Log("开始还原 Antigravity 官方原生纯净版本...");

            ThreadPool.QueueUserWorkItem(_ =>
            {
                string tempDir = Path.Combine(Path.GetTempPath(), "AgyUnpatch_" + Guid.NewGuid().ToString("N"));
                try
                {
                    Dispatcher.Invoke(() =>
                    {
                        lblStatus.Text = "正在退出 Antigravity 进程...";
                        progressBar.Value = 30;
                        Log("检查并关闭 Antigravity 进程...");
                    });

                    KillProcesses("Antigravity");
                    Thread.Sleep(800);

                    Dispatcher.Invoke(() =>
                    {
                        lblStatus.Text = "正在提取还原脚本...";
                        progressBar.Value = 50;
                    });

                    Directory.CreateDirectory(tempDir);
                    ExtractEmbeddedPayload(tempDir);

                    string unpatcherJs = Path.Combine(tempDir, "unpatcher.js");
                    if (!File.Exists(unpatcherJs))
                    {
                        throw new Exception("解压载荷失败，未找到 unpatcher.js！");
                    }

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

                    Dispatcher.Invoke(() =>
                    {
                        lblStatus.Text = "正在从备份恢复官方原生 app.asar...";
                        progressBar.Value = 75;
                        Log("执行官方内核还原流程...");
                    });

                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = runner,
                        Arguments = "\"" + unpatcherJs + "\" \"" + installDir + "\"",
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

                    using (var proc = Process.Start(psi))
                    {
                        proc.OutputDataReceived += (s, args) =>
                        {
                            if (!string.IsNullOrEmpty(args.Data))
                            {
                                Dispatcher.Invoke(() => Log(args.Data));
                            }
                        };
                        proc.ErrorDataReceived += (s, args) =>
                        {
                            if (!string.IsNullOrEmpty(args.Data))
                            {
                                Dispatcher.Invoke(() => Log("[ERR] " + args.Data));
                            }
                        };

                        proc.BeginOutputReadLine();
                        proc.BeginErrorReadLine();
                        proc.WaitForExit();

                        if (proc.ExitCode != 0)
                        {
                            throw new Exception("还原脚本执行失败，退出代码: " + proc.ExitCode);
                        }
                    }

                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 100;
                        lblStatus.Text = "✔ 官方原版已成功还原！客户端已恢复为默认英文状态。";
                        Log("==========================================");
                        Log("✔ 官方原生纯净版本已还原完成！");

                        MessageBox.Show(
                            "Antigravity 官方原版已成功还原！\n客户端已恢复为官方默认英文状态与原生设置。",
                            "还原成功 - Antigravity Enhance Tools",
                            MessageBoxButton.OK,
                            MessageBoxImage.Information);
                    });
                }
                catch (Exception ex)
                {
                    Dispatcher.Invoke(() =>
                    {
                        progressBar.Value = 0;
                        lblStatus.Text = "❌ 还原失败：" + ex.Message;
                        Log("❌ [错误] " + ex.Message);
                        MessageBox.Show("还原失败：\n" + ex.Message, "还原错误", MessageBoxButton.OK, MessageBoxImage.Error);
                    });
                }
                finally
                {
                    try { if (Directory.Exists(tempDir)) Directory.Delete(tempDir, true); } catch { }
                    Dispatcher.Invoke(() => SetWorking(false, lblStatus.Text));
                }
            });
        }

        public void ExportPreviews()
        {
            try
            {
                txtPath.Text = @"C:\Users\Lynan\AppData\Local\Programs\antigravity";
                lblPathStatus.Text = "● 已定位有效的 Antigravity 客户端目录 (已识别 resources/app.asar)";
                lblPathStatus.Foreground = new SolidColorBrush(Color.FromRgb(16, 185, 129));
                txtLog.Text = "[13:40:00] 自动检测到 Antigravity 安装目录: C:\\Users\\Lynan\\AppData\\Local\\Programs\\antigravity\r\n[13:40:01] 核心文件校验通过 (resources\\app.asar, 版本: 1.109.0)\r\n[13:40:01] 就绪状态：可点击下方按钮一键安装增强补丁或还原官方原版。";

                string assetsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "assets");
                if (!Directory.Exists(assetsDir))
                {
                    assetsDir = @"D:\desk\Antigravity\Antigravity-Enhance-Pack\assets";
                }
                string brainDir = @"C:\Users\Lynan\.gemini\antigravity\brain\52cfb1d6-5446-4024-b205-602befeaea39";

                // 1. Light theme
                ApplyTheme(false);
                SaveVisualAsPng((FrameworkElement)this.Content, Path.Combine(assetsDir, "gui_installer_light_preview.png"));
                SaveVisualAsPng((FrameworkElement)this.Content, Path.Combine(brainDir, "gui_installer_light_preview.png"));

                // 2. Dark theme
                ApplyTheme(true);
                SaveVisualAsPng((FrameworkElement)this.Content, Path.Combine(assetsDir, "gui_installer_dark_preview.png"));
                SaveVisualAsPng((FrameworkElement)this.Content, Path.Combine(brainDir, "gui_installer_dark_preview.png"));

                File.WriteAllText(@"C:\Users\Lynan\.gemini\antigravity\scratch\export_err.log", "SUCCESS");
            }
            catch (Exception ex)
            {
                File.WriteAllText(@"C:\Users\Lynan\.gemini\antigravity\scratch\export_err.log", ex.ToString());
            }
        }

        public void SetupMockupState()
        {
            txtPath.Text = @"C:\Users\Lynan\AppData\Local\Programs\antigravity";
            lblPathStatus.Text = "● 已定位有效的 Antigravity 客户端目录 (已识别 resources/app.asar)";
            lblPathStatus.Foreground = new SolidColorBrush(Color.FromRgb(16, 185, 129));
            txtLog.Text = "[14:00:00] 自动检测到 Antigravity 安装目录: C:\\Users\\Lynan\\AppData\\Local\\Programs\\antigravity\r\n[14:00:01] 核心文件校验通过 (resources\\app.asar, 版本: 1.109.0)\r\n[14:00:01] 就绪状态：可点击下方按钮一键安装增强补丁或还原官方原版。";
        }

        public static void SaveVisualAsPng(FrameworkElement visual, string outputPath)
        {
            int w = 750;
            int h = 745;
            visual.Measure(new Size(w, h));
            visual.Arrange(new Rect(0, 0, w, h));
            visual.UpdateLayout();

            var rtb = new RenderTargetBitmap(w, h, 96, 96, PixelFormats.Pbgra32);
            rtb.Render(visual);

            var encoder = new PngBitmapEncoder();
            encoder.Frames.Add(BitmapFrame.Create(rtb));
            using (var stream = new FileStream(outputPath, FileMode.Create))
            {
                encoder.Save(stream);
            }
        }

        private void ExtractEmbeddedPayload(string targetDir)
        {
            var asm = Assembly.GetExecutingAssembly();
            using (var s = asm.GetManifestResourceStream("payload.zip"))
            {
                if (s == null) throw new Exception("内置核心载荷资源 payload.zip 丢失！");
                string tempZip = Path.Combine(targetDir, "_payload.zip");
                using (var fs = File.Create(tempZip))
                {
                    s.CopyTo(fs);
                }
                ZipFile.ExtractToDirectory(tempZip, targetDir);
                File.Delete(tempZip);
            }
        }

        private void KillProcesses(string name)
        {
            try
            {
                var procs = Process.GetProcessesByName(name);
                foreach (var p in procs)
                {
                    try { p.Kill(); p.WaitForExit(3000); } catch { }
                }
            }
            catch { }
        }
    }
}
