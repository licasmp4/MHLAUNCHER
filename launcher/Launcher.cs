// MHGU Launcher (WPF): configura o MHGURecomp (mhgurecomp.ini), online, HUD de caça, mods e cheats, e abre o jogo.
// O layout fica em Main.xaml (recurso embutido, lido com XamlReader).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;

[assembly: System.Reflection.AssemblyTitle("MHGU Launcher")]
[assembly: System.Reflection.AssemblyVersion(Launcher.VERSAO)]
[assembly: System.Reflection.AssemblyFileVersion(Launcher.VERSAO)]
[assembly: System.Reflection.AssemblyProduct("MHGU pt-BR (licas.mp3)")]

class Ini
{
    public string Path;
    public List<string> Lines = new List<string>();
    public Ini(string path) { Path = path; Reload(); }
    public void Reload() { Lines = File.Exists(Path) ? File.ReadAllLines(Path, Encoding.UTF8).ToList() : new List<string>(); }

    // índice da linha "key = valor" dentro de [section], ou -1
    int Find(string section, string key, out int sectionEnd)
    {
        string cur = null; sectionEnd = -1;
        for (int i = 0; i < Lines.Count; i++)
        {
            string t = Lines[i].Trim();
            if (t.StartsWith("[") && t.EndsWith("]")) { cur = t.Substring(1, t.Length - 2); continue; }
            if (cur != section) continue;
            sectionEnd = i;
            if (t.StartsWith(";")) continue;
            int eq = t.IndexOf('=');
            if (eq > 0 && t.Substring(0, eq).Trim().Equals(key, StringComparison.OrdinalIgnoreCase)) return i;
        }
        return -1;
    }
    public string Get(string section, string key, string def)
    {
        int end; int i = Find(section, key, out end);
        if (i < 0) return def;
        string t = Lines[i]; return t.Substring(t.IndexOf('=') + 1).Trim();
    }
    public void Set(string section, string key, string value)
    {
        int end; int i = Find(section, key, out end);
        string line = key + " =" + (value.Length > 0 ? " " + value : "");
        if (i >= 0) { Lines[i] = line; return; }
        if (end >= 0) { Lines.Insert(end + 1, line); return; }
        Lines.Add(""); Lines.Add("[" + section + "]"); Lines.Add(line);
    }
    public void Save() { File.WriteAllLines(Path, Lines.ToArray(), new UTF8Encoding(false)); }
}

class App
{
    [STAThread]
    static void Main(string[] args)
    {
        System.Threading.Thread.CurrentThread.CurrentCulture = CultureInfo.InvariantCulture;  // 1.0 como no .ini
        var app = new Application();
        app.DispatcherUnhandledException += (s, e) => { MessageBox.Show(e.Exception.ToString(), "MHGU Launcher"); e.Handled = true; };
        Launcher l;
        try { l = new Launcher(args); } catch (Exception ex) { MessageBox.Show(ex.ToString(), "MHGU Launcher"); return; }
        if (l.Win != null) app.Run(l.Win);
    }
}

class Launcher
{
    // versão deste launcher: o Release no GitHub deve ter a tag "v" + uma versão maior para oferecer atualização
    public const string VERSAO = "2.2.0";
    const string REPO_LAUNCHER = "licasmp4/MONSTER-HUNTER-GU-PORT-LAUNHCER";
    static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    public Window Win;
    string Dir = AppDomain.CurrentDomain.BaseDirectory;
    Ini ini;
    bool carregando = true, semAnimacao;
    DispatcherTimer salvarDepois, toastTimer;

    // nomes dos plugins do HUD (procurados em mods\*\romfs\nativeNX\plugins)
    const string NRO_HP = "target_health_display.nro", NRO_DMG = "attack_damage_display.nro";

    T F<T>(string name) where T : class { return Win.FindName(name) as T; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct DEVMODE
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public short dmSpecVersion, dmDriverVersion, dmSize, dmDriverExtra;
        public int dmFields, dmPositionX, dmPositionY, dmDisplayOrientation, dmDisplayFixedOutput;
        public short dmColor, dmDuplex, dmYResolution, dmTTOption, dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public short dmLogPixels;
        public int dmBitsPerPel, dmPelsWidth, dmPelsHeight, dmDisplayFlags, dmDisplayFrequency;
        public int dmICMMethod, dmICMIntent, dmMediaType, dmDitherType, dmReserved1, dmReserved2, dmPanningWidth, dmPanningHeight;
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool EnumDisplaySettings(string dev, int mode, ref DEVMODE dm);

    public Launcher(string[] args)
    {
        if (!File.Exists(Path.Combine(Dir, "mhgurecomp.exe")))
        {
            MessageBox.Show("Coloque o MHGU Launcher na mesma pasta do mhgurecomp.exe.", "MHGU Launcher"); return;
        }
        ini = new Ini(Path.Combine(Dir, "mhgurecomp.ini"));
        using (var s = typeof(Launcher).Assembly.GetManifestResourceStream("Main.xaml")) Win = (Window)XamlReader.Load(s);
        Win.Title = "MHGU Launcher";
        Fontes();

        var logo = Imagem("mhgu.ico");
        if (logo != null) { F<ImageBrush>("imgLogo").ImageSource = logo; F<ImageBrush>("imgHero").ImageSource = logo; Win.Icon = logo; }

        F<Border>("titleBar").MouseLeftButtonDown += (s, e) => Win.DragMove();
        F<Button>("btnMin").Click += (s, e) => Win.WindowState = WindowState.Minimized;
        F<Button>("btnClose").Click += (s, e) => { SalvarAgora(); Win.Close(); };
        F<Button>("btnPlay").Click += (s, e) => Jogar();

        string[] navs = { "Home", "Video", "Perf", "Ctrl", "Online", "Hunt", "Mods", "About" };
        foreach (var n in navs)
        {
            string nome = n;
            F<RadioButton>("nav" + n).Checked += (s, e) =>
            {
                foreach (var m in navs) F<FrameworkElement>("pg" + m).Visibility = m == nome ? Visibility.Visible : Visibility.Collapsed;
                if (!carregando && !semAnimacao) MostrarPagina(F<FrameworkElement>("pg" + nome));
                if (!carregando) VideoVisivel();
                Resumo();
            };
        }

        salvarDepois = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(500) };
        salvarDepois.Tick += (s, e) => { salvarDepois.Stop(); SalvarAgora(); Toast("Salvo"); };
        toastTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        toastTimer.Tick += (s, e) =>
        {
            toastTimer.Stop();
            Animar(F<Border>("toastBox"), UIElement.OpacityProperty, 0, 300);
            Animar(F<TranslateTransform>("toastY"), TranslateTransform.YProperty, 12, 300);
        };
        // entrada da janela
        semAnimacao = Array.IndexOf(args, "--prints") >= 0;
        if (!semAnimacao)
        {
            Win.Opacity = 0;
            Win.Loaded += (s, e) => Animar(Win, UIElement.OpacityProperty, 1, 280);
        }

        Video(); Perf(); Perfis(); Ctrl(); Online(); Hunt(); Mods(); About(); Cacadores(); Versao(); HudDiag(); AutoUpdate(args); Cenas(); Visual(navs); Presenca();
        carregando = false;
        Resumo();

        // testes: --prints <pasta> salva uma imagem de cada página; --salvar grava sem mudar nada
        // testes do layout: --largura N (janela estreita) e --buscar texto (abre a busca)
        int il = Array.IndexOf(args, "--largura"); double larg;
        if (il >= 0 && il + 1 < args.Length && double.TryParse(args[il + 1], NumberStyles.Float, Inv, out larg)) Win.Width = larg;
        int ib = Array.IndexOf(args, "--buscar");
        if (ib >= 0 && ib + 1 < args.Length) Win.ContentRendered += (s, e) => F<TextBox>("txtSearch").Text = args[ib + 1];
        // teste: --medir <arquivo> mede quanto cada troca de página leva (clique até a tela pronta)
        int im = Array.IndexOf(args, "--medir");
        if (im >= 0 && im + 1 < args.Length) Win.ContentRendered += async (s, e) =>
        {
            await Task.Delay(3000);
            var linhas = new List<string>();
            for (int volta = 0; volta < 2; volta++)
                foreach (var n in navs.Reverse().Concat(new[] { "Home" }))
                {
                    var sw = Stopwatch.StartNew();
                    F<RadioButton>("nav" + n).IsChecked = true;
                    Win.UpdateLayout();
                    await Win.Dispatcher.InvokeAsync(() => { }, DispatcherPriority.Render);
                    linhas.Add(n + ": " + sw.ElapsedMilliseconds + " ms");
                    await Task.Delay(400);
                }
            File.WriteAllLines(args[im + 1], linhas);
            Win.Close();
        };
        int ia = Array.IndexOf(args, "--prints");
        if (ia >= 0 && ia + 1 < args.Length) Win.ContentRendered += (s, e) => Prints(args[ia + 1], navs);
        if (Array.IndexOf(args, "--jogar") >= 0) Win.ContentRendered += (s, e) => Jogar();
        // teste: --teste-correcoes <exe> simula um Release com mhgurecomp-<versão instalada>-licas1.exe
        int ic = Array.IndexOf(args, "--teste-correcoes");
        if (ic >= 0 && ic + 1 < args.Length) Win.ContentRendered += async (s, e) =>
        {
            string url = new Uri(Path.GetFullPath(args[ic + 1])).AbsoluteUri;
            string falso = "{\"browser_download_url\": \"" + url.Replace(Path.GetFileName(args[ic + 1]), "mhgurecomp-" + VersaoInstalada() + "-licas1.exe") + "\"}";
            VerificarCorrecoes(falso);
            await AplicarCorrecoes();
            File.WriteAllText(Path.Combine(Dir, "teste_correcoes.txt"), F<TextBlock>("txtVerSub").Text + " | " + F<TextBlock>("txtVer").Text);
            Win.Close();
        };
        if (Array.IndexOf(args, "--atualizar") >= 0) Win.ContentRendered += async (s, e) =>
        {
            await ProcurarVersao(); await Atualizar();
            File.WriteAllText(Path.Combine(Dir, "teste_atualizar.txt"), F<TextBlock>("txtVerSub").Text);
            Win.Close();
        };
        if (Array.IndexOf(args, "--salvar") >= 0) Win.ContentRendered += (s, e) => { SalvarAgora(); Win.Close(); };
    }

    // ---------- fontes: Alegreya Sans (texto) e Cinzel (títulos, letras de guilda), embutidas no exe (licença SIL OFL 1.1)
    static readonly string[] FONTES = { "AlegreyaSans-Regular", "AlegreyaSans-Medium", "AlegreyaSans-Bold", "AlegreyaSans-ExtraBold", "Cinzel-SemiBold", "Cinzel-Bold", "Cinzel-Black" };
    void Fontes()
    {
        try
        {
            string pasta = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MHGU Launcher", "fontes");
            Directory.CreateDirectory(pasta);
            var asm = typeof(Launcher).Assembly;
            foreach (var n in FONTES)
            {
                string arq = Path.Combine(pasta, n + ".ttf");
                using (var r = asm.GetManifestResourceStream("fonte." + n + ".ttf"))
                {
                    if (r == null) return;
                    if (File.Exists(arq) && new FileInfo(arq).Length == r.Length) continue;
                    using (var w = File.Create(arq)) r.CopyTo(w);
                }
            }
            var baseUri = new Uri(pasta + Path.DirectorySeparatorChar);
            Win.FontFamily = new FontFamily(baseUri, "./#Alegreya Sans, Segoe UI");
            Win.Resources["Display"] = new FontFamily(baseUri, "./#Cinzel, Segoe UI");
        }
        catch { }  // sem as fontes, fica a do Windows
    }

    // ---------- utilidades
    BitmapSource Imagem(string arquivo)
    {
        string p = Path.Combine(Dir, arquivo);
        if (!File.Exists(p)) return null;
        try
        {
            var dec = BitmapDecoder.Create(new Uri(p), BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
            return dec.Frames.OrderByDescending(f => f.PixelWidth).First();
        }
        catch { return null; }
    }
    void Mudou() { if (!carregando) { salvarDepois.Stop(); salvarDepois.Start(); Resumo(); PerfilAtual(); } }
    void Toast(string t)
    {
        F<TextBlock>("txtToast").Text = "✦  " + t;
        Animar(F<Border>("toastBox"), UIElement.OpacityProperty, 1, 180);
        Animar(F<TranslateTransform>("toastY"), TranslateTransform.YProperty, 0, 220);
        toastTimer.Stop(); toastTimer.Start();
    }

    // animação curta com desaceleração (visual do launcher)
    static void Animar(System.Windows.Media.Animation.IAnimatable alvo, DependencyProperty p, double para, int ms, double? de = null)
    {
        var a = new System.Windows.Media.Animation.DoubleAnimation(para, TimeSpan.FromMilliseconds(ms))
        { EasingFunction = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut } };
        if (de.HasValue) a.From = de.Value;
        alvo.BeginAnimation(p, a);
    }

    // troca de página: a nova entra deslizando de baixo e aparecendo
    // os blocos da página sobem e aparecem um depois do outro; cada um vira imagem enquanto anima (leve)
    void MostrarPagina(FrameworkElement pg)
    {
        var sv = pg as ScrollViewer; var sp = sv != null ? sv.Content as Panel : null;
        if (sp == null) return;
        sv.ScrollToVerticalOffset(0);
        var ease = new System.Windows.Media.Animation.CubicEase { EasingMode = System.Windows.Media.Animation.EasingMode.EaseOut };
        int i = 0;
        foreach (UIElement c in sp.Children)
        {
            if (c.Visibility != Visibility.Visible) continue;
            if (i >= 7) { c.BeginAnimation(UIElement.OpacityProperty, null); c.Opacity = 1; continue; }
            var tt = c.RenderTransform as TranslateTransform;
            if (tt == null) { tt = new TranslateTransform(); c.RenderTransform = tt; }
            var el = c;
            el.CacheMode = new BitmapCache { RenderAtScale = 1 };
            var atraso = TimeSpan.FromMilliseconds(i * 40);
            var op = new System.Windows.Media.Animation.DoubleAnimation(0, 1, TimeSpan.FromMilliseconds(240)) { BeginTime = atraso, EasingFunction = ease };
            op.Completed += (s, e) => el.CacheMode = null;
            var y = new System.Windows.Media.Animation.DoubleAnimation(16, 0, TimeSpan.FromMilliseconds(320)) { BeginTime = atraso, EasingFunction = ease };
            el.Opacity = 0;
            el.BeginAnimation(UIElement.OpacityProperty, op);
            tt.BeginAnimation(TranslateTransform.YProperty, y);
            i++;
        }
    }
    static string Num(double v, string fmt) { return v.ToString(fmt, Inv); }
    double D(string s, double def) { double v; return double.TryParse(s, NumberStyles.Float, Inv, out v) ? v : def; }
    static bool On(string v) { return v.Equals("On", StringComparison.OrdinalIgnoreCase); }
    static string OnOff(bool b) { return b ? "On" : "Off"; }

    // ComboBox com (texto mostrado, valor no .ini)
    void Combo(string nome, string sec, string key, string def, string[,] itens)
    {
        var c = F<ComboBox>(nome);
        string atual = ini.Get(sec, key, def); int sel = -1;
        for (int i = 0; i < itens.GetLength(0); i++)
        {
            c.Items.Add(new ComboBoxItem { Content = itens[i, 0], Tag = itens[i, 1] });
            if (itens[i, 1].Equals(atual, StringComparison.OrdinalIgnoreCase)) sel = i;
        }
        if (sel < 0) { c.Items.Add(new ComboBoxItem { Content = atual, Tag = atual }); sel = c.Items.Count - 1; }
        c.SelectedIndex = sel;
        c.SelectionChanged += (s, e) => { ini.Set(sec, key, (string)((ComboBoxItem)c.SelectedItem).Tag); Mudou(); };
    }
    void Toggle(string nome, string sec, string key, string def)
    {
        var t = F<CheckBox>(nome);
        t.IsChecked = On(ini.Get(sec, key, def));
        RoutedEventHandler h = (s, e) => { ini.Set(sec, key, OnOff(t.IsChecked == true)); Mudou(); };
        t.Checked += h; t.Unchecked += h;
    }
    void SliderIni(Slider sl, TextBlock v, string sec, string key, double def, string fmt, string sufixo)
    {
        sl.Value = D(ini.Get(sec, key, Num(def, "0.0")), def);
        v.Text = Num(sl.Value, fmt) + sufixo;
        sl.ValueChanged += (s, e) => { v.Text = Num(sl.Value, fmt) + sufixo; ini.Set(sec, key, Num(sl.Value, fmt == "0" ? "0" : "0.0#")); Mudou(); };
    }
    void Abrir(string pasta) { Directory.CreateDirectory(pasta); Process.Start("explorer.exe", "\"" + pasta + "\""); }

    int Hz()
    {
        var dm = new DEVMODE(); dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        return EnumDisplaySettings(null, -1, ref dm) ? dm.dmDisplayFrequency : 60;
    }
    string Monitor()
    {
        var dm = new DEVMODE(); dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        return EnumDisplaySettings(null, -1, ref dm) ? dm.dmPelsWidth + "x" + dm.dmPelsHeight : "?";
    }

    // ---------- páginas
    void Video()
    {
        Combo("cbMode", "Display", "Mode", "Borderless", new[,] { { "Tela cheia sem borda", "Borderless" }, { "Tela cheia", "Fullscreen" }, { "Janela", "Windowed" } });
        var res = new List<string>();
        var dm = new DEVMODE(); dm.dmSize = (short)Marshal.SizeOf(typeof(DEVMODE));
        for (int i = 0; EnumDisplaySettings(null, i, ref dm); i++)
        {
            string r = dm.dmPelsWidth + "x" + dm.dmPelsHeight;
            if (dm.dmPelsWidth >= 1024 && !res.Contains(r)) res.Add(r);
        }
        res = res.OrderByDescending(r => int.Parse(r.Split('x')[0]) * int.Parse(r.Split('x')[1])).ToList();
        var itens = new string[res.Count + 1, 2];
        itens[0, 0] = "Do monitor (" + Monitor() + ")"; itens[0, 1] = "Desktop";
        for (int i = 0; i < res.Count; i++) { itens[i + 1, 0] = res[i]; itens[i + 1, 1] = res[i]; }
        Combo("cbRes", "Display", "Resolution", "Desktop", itens);
        Combo("cbRender", "Display", "RenderResolution", "Auto", new[,] { { "Automática", "Auto" }, { "720p (leve)", "1280x720" }, { "1080p", "1920x1080" }, { "1440p", "2560x1440" }, { "4K (pesado, mais nítido)", "3840x2160" } });
        Combo("cbAspect", "Display", "AspectRatio", "Auto", new[,] { { "Automática", "Auto" }, { "16:9", "16:9" }, { "16:10", "16:10" }, { "21:9 ultrawide", "21:9" }, { "32:9 super ultrawide", "32:9" } });
        Combo("cbUi", "Display", "UIAnchor", "Center", new[,] { { "No centro", "Center" }, { "Nas bordas", "Edges" } });
        Combo("cbMsaa", "Anti-aliasing", "MSAA", "Off", new[,] { { "Desligado", "Off" }, { "2x", "2x" }, { "4x", "4x" }, { "8x", "8x" } });
        Toggle("tgFxaa", "Anti-aliasing", "FXAA", "On");
        // FOV em graus: o .ini guarda um fator (1.0 = jogo); mostramos 90° como o padrão e limitamos a 70°-120°
        var fov = F<Slider>("slFov"); var vf = F<TextBlock>("vFov");
        fov.Value = Math.Max(70, Math.Min(120, Math.Round(D(ini.Get("Display", "FOV", "1.0"), 1.0) * 90)));
        vf.Text = (int)fov.Value + "°";
        fov.ValueChanged += (s, e) => { vf.Text = (int)fov.Value + "°"; ini.Set("Display", "FOV", Num(fov.Value / 90.0, "0.###")); Mudou(); };
        foreach (int g in new[] { 80, 90, 100, 110, 120 })
        {
            int val = g; var b = new Button { Content = g + "°" + (g == 90 ? " padrão" : ""), Style = (Style)Win.FindResource("Chip") };
            b.Click += (s, e) => fov.Value = val; F<WrapPanel>("fovQuick").Children.Add(b);
        }
    }

    void Perf()
    {
        int hz = Hz();
        F<TextBlock>("txtMonitor").Text = "Seu monitor: " + Monitor() + " a " + hz + " Hz.";
        var sl = F<Slider>("slFps"); var v = F<TextBlock>("vFps");
        SliderIni(sl, v, "Performance", "FPS", 60, "0", "");
        var quick = F<WrapPanel>("fpsQuick");
        var estilo = (Style)Win.FindResource("Chip");
        foreach (int f in new[] { 30, 60, 120, 144, 165, 240 })
        {
            int val = f; var b = new Button { Content = f + " FPS", Style = estilo };
            b.Click += (s, e) => sl.Value = val; quick.Children.Add(b);
        }
        var bm = new Button { Content = "Igual ao monitor (" + hz + ")", Style = estilo, Foreground = (Brush)Win.FindResource("Gold") };
        bm.Click += (s, e) => sl.Value = Math.Max(30, Math.Min(240, hz)); quick.Children.Add(bm);
        Toggle("tgVsync", "Performance", "VSync", "On");
        RoutedEventHandler dica = (s, e) => Dica(hz);
        F<CheckBox>("tgVsync").Checked += dica; F<CheckBox>("tgVsync").Unchecked += dica;
        sl.ValueChanged += (s, e) => Dica(hz);
        Dica(hz);
    }
    void Dica(int hz)
    {
        int fps = (int)F<Slider>("slFps").Value; bool vs = F<CheckBox>("tgVsync").IsChecked == true;
        string t;
        if (vs && fps > hz) t = "Com VSync ligado o jogo não passa de " + hz + " FPS no seu monitor.";
        else if (vs && hz % fps != 0) t = "Dica: com VSync, um limite que divide " + hz + " (ex.: " + hz + " ou " + (hz / 2) + ") fica mais liso.";
        else t = "Boa escolha para o seu monitor.";
        F<TextBlock>("txtFpsTip").Text = t;
    }

    void Ctrl()
    {
        Combo("cbButtons", "Controls", "FaceButtons", "Position", new[,] { { "Pela posição (Switch)", "Position" }, { "Pela letra (Xbox)", "Label" } });
        SliderIni(F<Slider>("slMouse"), F<TextBlock>("vMouse"), "Mouse", "MouseSensitivity", 1.0, "0.0", "");
        string pad = "Nenhum controle detectado no último jogo.";
        try
        {
            string log = Path.Combine(Dir, "log.txt");
            if (File.Exists(log))
            {
                var l = File.ReadAllLines(log).LastOrDefault(x => x.Contains("[input] gamepad in use:"));
                if (l != null) pad = "Último controle usado: " + l.Substring(l.IndexOf(':') + 1).Split('(')[0].Trim() + ".";
            }
        }
        catch { }
        F<TextBlock>("txtPad").Text = pad;

        F<ComboBox>("cbButtons").SelectionChanged += (s, e) => MapaBotoes();
        string[,] teclas = { { "F12", "Screenshot (pasta shots)" }, { "F7", "Troca o anti-serrilhado (MSAA)" }, { "Alt + Enter", "Janela / tela cheia" },
                             { "Insert", "Menu Forge (barra de vida, dano)" }, { "Clique", "Prende o mouse para a câmera" }, { "Esc", "Solta o mouse / volta para janela" }, { "F11", "Tela cheia (pelo launcher)" } };
        for (int i = 0; i < teclas.GetLength(0); i++) F<UniformGrid>("keysMap").Children.Add(Tecla(teclas[i, 0], teclas[i, 1]));

        var hk = F<CheckBox>("tgHotkeys");
        hk.IsChecked = Config("teclas_tela", "1") == "1";
        RoutedEventHandler hh = (s, e) => { SetConfig("teclas_tela", hk.IsChecked == true ? "1" : "0"); Toast(hk.IsChecked == true ? "F11 / Esc ligados" : "F11 / Esc desligados"); };
        hk.Checked += hh; hk.Unchecked += hh;
        padTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        padTimer.Tick += (s, e) => { if (F<FrameworkElement>("pgCtrl").Visibility == Visibility.Visible) AtualizarPads(); };
        padTimer.Start();
        AtualizarPads();
    }

    // ---------- controles conectados (pelo VID/PID dos dispositivos HID)
    DispatcherTimer padTimer;
    string padTipo = "";   // "ps", "xbox", "nintendo" ou ""
    bool lendoPads;
    class Pad { public string Nome, Tipo, Via; }

    // mouses e teclados da Microsoft/Logitech/Razer também são HID: desses, só conta o que for XInput (IG_)
    static Pad Identificar(string vid, string pid, bool xinput)
    {
        switch (vid)
        {
            case "054C":
                if (pid == "0CE6") return new Pad { Nome = "DualSense (PS5)", Tipo = "ps" };
                if (pid == "0DF2") return new Pad { Nome = "DualSense Edge (PS5)", Tipo = "ps" };
                if (pid == "05C4" || pid == "09CC" || pid == "0BA0") return new Pad { Nome = "DualShock 4 (PS4)", Tipo = "ps" };
                return new Pad { Nome = "Controle PlayStation", Tipo = "ps" };
            case "045E": return xinput ? new Pad { Nome = "Controle Xbox", Tipo = "xbox" } : null;
            case "057E":
                if (pid == "2009") return new Pad { Nome = "Pro Controller (Switch)", Tipo = "nintendo" };
                if (pid == "2006" || pid == "2007") return new Pad { Nome = "Joy-Con", Tipo = "nintendo" };
                return null;
            case "2DC8": return new Pad { Nome = "Controle 8BitDo", Tipo = "xbox" };
            case "0079": case "0810": case "11C0": case "20D6": case "0738": case "146B": return new Pad { Nome = "Controle genérico", Tipo = "xbox" };
            case "0E6F": case "24C6": case "0F0D": case "1532": case "046D": return xinput ? new Pad { Nome = "Controle (Xbox compatível)", Tipo = "xbox" } : null;
        }
        return null;
    }
    void AtualizarPads()
    {
        if (lendoPads) return; lendoPads = true;
        Task.Run(() =>
        {
            var lista = new List<Pad>();
            try
            {
                using (var q = new System.Management.ManagementObjectSearcher("SELECT DeviceID FROM Win32_PnPEntity WHERE DeviceID LIKE 'HID%'"))
                    foreach (System.Management.ManagementObject o in q.Get())
                    {
                        string id = (o["DeviceID"] ?? "").ToString().ToUpperInvariant();
                        var m = System.Text.RegularExpressions.Regex.Match(id, @"VID(?:_|&0002)([0-9A-F]{4})[&_]PID[&_]([0-9A-F]{4})");
                        if (!m.Success) continue;
                        var p = Identificar(m.Groups[1].Value, m.Groups[2].Value, id.Contains("&IG_"));
                        if (p == null) continue;
                        p.Via = id.Contains("00001124-0000-1000-8000-00805F9B34FB") || id.Contains("BTH") ? "Bluetooth" : "USB";
                        if (!lista.Any(x => x.Nome == p.Nome && x.Via == p.Via)) lista.Add(p);
                    }
            }
            catch { }
            Win.Dispatcher.Invoke(() =>
            {
                lendoPads = false;
                var sp = F<StackPanel>("padsList"); sp.Children.Clear();
                foreach (var p in lista)
                {
                    var g = new Grid { Margin = new Thickness(0, 4, 0, 4) };
                    g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(40) });
                    g.ColumnDefinitions.Add(new ColumnDefinition());
                    g.Children.Add(new TextBlock { Text = "", FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 22, Foreground = (Brush)Win.FindResource("Gold"), VerticalAlignment = VerticalAlignment.Center });
                    var t = new StackPanel(); Grid.SetColumn(t, 1);
                    t.Children.Add(new TextBlock { Text = p.Nome, FontSize = 16, FontWeight = FontWeights.SemiBold });
                    t.Children.Add(new TextBlock { Text = "Conectado por " + p.Via + " · reconhecido pelo port", FontSize = 12, Foreground = (Brush)Win.FindResource("Ok") });
                    g.Children.Add(t); sp.Children.Add(g);
                }
                if (lista.Count == 0) sp.Children.Add(new TextBlock { Text = "Nenhum controle conectado. Ligue o controle (USB ou Bluetooth) que ele aparece aqui. Teclado e mouse também funcionam.", Style = (Style)Win.FindResource("Hint") });
                string tipo = lista.Count > 0 ? lista[0].Tipo : "";
                if (tipo != padTipo || F<UniformGrid>("padMap").Children.Count == 0) { padTipo = tipo; MapaBotoes(); }
            });
        });
    }

    // botão do Switch -> botão no controle conectado
    void MapaBotoes()
    {
        var map = F<UniformGrid>("padMap"); map.Children.Clear();
        var c = F<ComboBox>("cbButtons");
        bool porLetra = c.SelectedItem != null && (string)((ComboBoxItem)c.SelectedItem).Tag == "Label";
        string t = padTipo == "" ? "ps" : padTipo;
        F<TextBlock>("txtMapTitle").Text = "Botões no seu controle" + (padTipo == "" ? " (exemplo: PlayStation)" : "");
        string a, b, x, y, l, r, zl, zr, mais, menos, ls, rs;
        if (t == "ps")
        {
            if (porLetra) { a = "✕"; b = "○"; x = "☐"; y = "△"; } else { a = "○"; b = "✕"; x = "△"; y = "☐"; }
            l = "L1"; r = "R1"; zl = "L2"; zr = "R2"; mais = "Options"; menos = "Create / Share"; ls = "L3"; rs = "R3";
        }
        else if (t == "xbox")
        {
            if (porLetra) { a = "A"; b = "B"; x = "X"; y = "Y"; } else { a = "B"; b = "A"; x = "Y"; y = "X"; }
            l = "LB"; r = "RB"; zl = "LT"; zr = "RT"; mais = "Menu ☰"; menos = "Exibir ⧉"; ls = "LS"; rs = "RS";
        }
        else { a = "A"; b = "B"; x = "X"; y = "Y"; l = "L"; r = "R"; zl = "ZL"; zr = "ZR"; mais = "+"; menos = "−"; ls = "L3"; rs = "R3"; }
        string[,] linhas = { { "A", a, "confirmar" }, { "B", b, "voltar" }, { "X", x, "" }, { "Y", y, "" }, { "L", l, "" }, { "R", r, "" },
                             { "ZL", zl, "" }, { "ZR", zr, "" }, { "+", mais, "menu" }, { "−", menos, "" }, { "Analógico esq.", ls + " (apertar)", "" }, { "Analógico dir.", rs + " (apertar)", "" } };
        for (int i = 0; i < linhas.GetLength(0); i++) map.Children.Add(Botao(linhas[i, 0], linhas[i, 1], linhas[i, 2]));
    }
    UIElement Botao(string sw, string seu, string uso)
    {
        var g = new Grid { Margin = new Thickness(0, 3, 16, 3) };
        g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(165) });
        g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(28) });
        g.ColumnDefinitions.Add(new ColumnDefinition());
        g.Children.Add(new TextBlock { Text = "Switch " + sw + (uso.Length > 0 ? "  · " + uso : ""), FontSize = 13, Foreground = (Brush)Win.FindResource("Sub"), VerticalAlignment = VerticalAlignment.Center });
        var seta = new TextBlock { Text = "", FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 11, Foreground = (Brush)Win.FindResource("Sub"), VerticalAlignment = VerticalAlignment.Center };
        Grid.SetColumn(seta, 1); g.Children.Add(seta);
        var chip = new Border { Background = (Brush)Win.FindResource("CardHi"), CornerRadius = new CornerRadius(6), Padding = new Thickness(10, 3, 10, 3), HorizontalAlignment = HorizontalAlignment.Left };
        chip.Child = new TextBlock { Text = seu, FontSize = 15, FontWeight = FontWeights.SemiBold, Foreground = (Brush)Win.FindResource("GoldHi") };
        Grid.SetColumn(chip, 2); g.Children.Add(chip);
        return g;
    }
    UIElement Tecla(string tecla, string acao)
    {
        var sp = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 4, 16, 4) };
        var chip = new Border { Background = (Brush)Win.FindResource("CardHi"), BorderBrush = (Brush)Win.FindResource("Line"), BorderThickness = new Thickness(1, 1, 1, 3), CornerRadius = new CornerRadius(6), Padding = new Thickness(10, 3, 10, 3), MinWidth = 44 };
        chip.Child = new TextBlock { Text = tecla, FontSize = 13, FontWeight = FontWeights.SemiBold, HorizontalAlignment = HorizontalAlignment.Center };
        sp.Children.Add(chip);
        sp.Children.Add(new TextBlock { Text = acao, FontSize = 13, Foreground = (Brush)Win.FindResource("Sub"), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(12, 0, 0, 0) });
        return sp;
    }

    // ---------- online
    string AmigosArq { get { return Path.Combine(Dir, "launcher_amigos.txt"); } }

    void Online()
    {
        var txtJoin = F<TextBox>("txtJoin"); var txtPort = F<TextBox>("txtPort");
        txtJoin.Text = ini.Get("Multiplayer", "Join", "");
        txtPort.Text = ini.Get("Multiplayer", "Port", "39500");
        bool entrar = txtJoin.Text.Length > 0;
        F<RadioButton>(entrar ? "rbJoin" : "rbHost").IsChecked = true;
        Modo(entrar);
        F<RadioButton>("rbHost").Checked += (s, e) => { Modo(false); ini.Set("Multiplayer", "Join", ""); Mudou(); };
        F<RadioButton>("rbJoin").Checked += (s, e) => { Modo(true); ini.Set("Multiplayer", "Join", txtJoin.Text.Trim()); Mudou(); };
        txtJoin.TextChanged += (s, e) => { if (F<RadioButton>("rbJoin").IsChecked == true) { ini.Set("Multiplayer", "Join", txtJoin.Text.Trim()); Mudou(); } };
        txtPort.TextChanged += (s, e) => { int p; if (int.TryParse(txtPort.Text, out p) && p > 0 && p < 65536) { ini.Set("Multiplayer", "Port", p.ToString()); Mudou(); FirewallStatus(); } };
        Toggle("tgSync", "Multiplayer", "SyncSmallMonsters", "On");

        IpList();
        F<Button>("btnPublicIp").Click += async (s, e) =>
        {
            var b = (Button)s; b.Content = "Consultando..."; b.IsEnabled = false;
            string ip = null;
            try { ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12; ip = (await new WebClient().DownloadStringTaskAsync("https://api.ipify.org")).Trim(); }
            catch { }
            b.IsEnabled = true; b.Content = "Descobrir IP da internet";
            if (ip == null) { Toast("Sem internet?"); return; }
            AddIp("Internet (precisa abrir a porta no roteador)", ip, "");
        };
        F<Button>("btnFirewall").Click += (s, e) => LiberarFirewall();
        FirewallStatus();

        F<Button>("btnTest").Click += async (s, e) => await Testar();
        F<Button>("btnSaveFriend").Click += (s, e) =>
        {
            string a = txtJoin.Text.Trim(); if (a.Length == 0) return;
            var l = Amigos(); if (!l.Contains(a)) { l.Add(a); File.WriteAllLines(AmigosArq, l.ToArray()); }
            ListaAmigos(); Toast("Amigo salvo");
        };
        ListaAmigos();
    }
    void Modo(bool entrar)
    {
        F<FrameworkElement>("panelHost").Visibility = entrar ? Visibility.Collapsed : Visibility.Visible;
        F<FrameworkElement>("panelJoin").Visibility = entrar ? Visibility.Visible : Visibility.Collapsed;
    }

    void IpList()
    {
        F<StackPanel>("ipList").Children.Clear();
        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up && n.NetworkInterfaceType != NetworkInterfaceType.Loopback))
            foreach (var a in ni.GetIPProperties().UnicastAddresses.Where(u => u.Address.AddressFamily == AddressFamily.InterNetwork))
            {
                string ip = a.Address.ToString(), nome = ni.Description + " " + ni.Name;
                string tipo;
                if (ip.StartsWith("169.254.")) continue;
                if (ip.StartsWith("26.") || nome.IndexOf("Radmin", StringComparison.OrdinalIgnoreCase) >= 0) tipo = "Radmin VPN (recomendado: sem abrir porta)";
                else if (nome.IndexOf("ZeroTier", StringComparison.OrdinalIgnoreCase) >= 0) tipo = "ZeroTier";
                else if (nome.IndexOf("Hamachi", StringComparison.OrdinalIgnoreCase) >= 0 || ip.StartsWith("25.")) tipo = "Hamachi";
                else if (nome.IndexOf("Tailscale", StringComparison.OrdinalIgnoreCase) >= 0 || ip.StartsWith("100.")) tipo = "Tailscale";
                else if (nome.IndexOf("vEthernet", StringComparison.OrdinalIgnoreCase) >= 0 || nome.IndexOf("VirtualBox", StringComparison.OrdinalIgnoreCase) >= 0 || nome.IndexOf("VMware", StringComparison.OrdinalIgnoreCase) >= 0) continue;
                else tipo = "Rede local (mesma casa / Wi-Fi)";
                AddIp(tipo, ip, tipo.StartsWith("Rede") ? "" : "");
            }
    }
    void AddIp(string tipo, string ip, string icone)
    {
        string porta = F<TextBox>("txtPort").Text.Trim();
        string endereco = porta == "39500" || porta.Length == 0 ? ip : ip + ":" + porta;
        var g = new Grid { Margin = new Thickness(0, 4, 0, 4) };
        g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(34) });
        g.ColumnDefinitions.Add(new ColumnDefinition());
        g.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        g.Children.Add(new TextBlock { Text = icone, FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 18, Foreground = (Brush)Win.FindResource("Gold"), VerticalAlignment = VerticalAlignment.Center });
        var sp = new StackPanel(); Grid.SetColumn(sp, 1);
        sp.Children.Add(new TextBlock { Text = endereco, FontSize = 18, FontWeight = FontWeights.SemiBold, FontFamily = new FontFamily("Consolas") });
        sp.Children.Add(new TextBlock { Text = tipo, FontSize = 12, Foreground = (Brush)Win.FindResource("Sub") });
        g.Children.Add(sp);
        var b = new Button { Content = "Copiar", Style = (Style)Win.FindResource("Btn"), VerticalAlignment = VerticalAlignment.Center, Width = 90 };
        b.Click += (s, e) => { try { Clipboard.SetText(endereco); Toast("Copiado: " + endereco); } catch { } };
        Grid.SetColumn(b, 2); g.Children.Add(b);
        F<StackPanel>("ipList").Children.Add(g);
    }

    void FirewallStatus()
    {
        var t = F<TextBlock>("txtFw");
        Task.Run(() =>
        {
            string saida = "";
            try
            {
                var p = Process.Start(new ProcessStartInfo("netsh", "advfirewall firewall show rule name=MHGURecomp") { UseShellExecute = false, RedirectStandardOutput = true, CreateNoWindow = true, StandardOutputEncoding = Encoding.Default });
                saida = p.StandardOutput.ReadToEnd(); p.WaitForExit();
            }
            catch { }
            // a porta do jogo e a dos amigos online (porta + 1)
            bool ok = saida.Contains("MHGURecomp") && saida.Contains(PortaJogo().ToString()) && saida.Contains((PortaJogo() + 1).ToString());
            Win.Dispatcher.Invoke(() =>
            {
                t.Text = ok ? "Liberado para o jogo e as portas " + PortaJogo() + " e " + (PortaJogo() + 1) + "." : "Falta liberar (inclui a porta " + (PortaJogo() + 1) + ", que mostra você online para os amigos).";
                t.Foreground = (Brush)Win.FindResource(ok ? "Ok" : "Sub");
                F<Button>("btnFirewall").Content = ok ? "Liberado ✓" : "Liberar";
            });
        });
    }
    void LiberarFirewall()
    {
        string exe = Path.Combine(Dir, "mhgurecomp.exe"), porta = ini.Get("Multiplayer", "Port", "39500");
        string cmd = "/c netsh advfirewall firewall delete rule name=\"MHGURecomp\" & " +
                     "netsh advfirewall firewall add rule name=\"MHGURecomp\" dir=in action=allow program=\"" + exe + "\" enable=yes & " +
                     "netsh advfirewall firewall add rule name=\"MHGURecomp\" dir=in action=allow protocol=TCP localport=" + porta + " & " +
                     "netsh advfirewall firewall add rule name=\"MHGURecomp\" dir=in action=allow protocol=UDP localport=" + porta + " & " +
                     "netsh advfirewall firewall add rule name=\"MHGURecomp\" dir=in action=allow protocol=UDP localport=" + (PortaJogo() + 1);
        try
        {
            var pr = Process.Start(new ProcessStartInfo("cmd.exe", cmd) { Verb = "runas", UseShellExecute = true, WindowStyle = ProcessWindowStyle.Hidden });
            pr.WaitForExit();
        }
        catch { Toast("Cancelado"); }
        FirewallStatus();
    }

    async Task Testar()
    {
        var t = F<TextBlock>("txtTest");
        string a = F<TextBox>("txtJoin").Text.Trim();
        if (a.Length == 0) { t.Text = "Digite o endereço do amigo."; return; }
        string host = a; int porta;
        if (!int.TryParse(ini.Get("Multiplayer", "Port", "39500"), out porta)) porta = 39500;
        int c = a.LastIndexOf(':');
        if (c > 0) { host = a.Substring(0, c); int.TryParse(a.Substring(c + 1), out porta); }
        t.Foreground = (Brush)Win.FindResource("Sub"); t.Text = "Testando " + host + ":" + porta + "...";
        bool ok = false; string erro = "";
        try
        {
            using (var cli = new TcpClient())
            {
                var con = cli.ConnectAsync(host, porta);
                ok = await Task.WhenAny(con, Task.Delay(4000)) == con && cli.Connected;
                if (!ok) erro = "sem resposta";
            }
        }
        catch (Exception ex) { erro = ex.Message; }
        t.Foreground = (Brush)Win.FindResource(ok ? "Ok" : "Bad");
        t.Text = ok ? "✓ Conectou! O Hub do amigo está aberto. Pode clicar em JOGAR."
                    : "✗ Não conectou (" + erro + "). O amigo já criou o Hub? Firewall liberado? Mesmo IP de VPN?";
    }

    List<string> Amigos() { return File.Exists(AmigosArq) ? File.ReadAllLines(AmigosArq).Where(x => x.Trim().Length > 0).ToList() : new List<string>(); }
    void ListaAmigos()
    {
        var w = F<WrapPanel>("friendsList"); w.Children.Clear();
        var l = Amigos();
        F<TextBlock>("txtNoFriends").Visibility = l.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
        foreach (var a in l)
        {
            string end = a;
            var b = new Button { Style = (Style)Win.FindResource("Chip") };
            var sp = new StackPanel { Orientation = Orientation.Horizontal };
            sp.Children.Add(new TextBlock { Text = end, FontFamily = new FontFamily("Consolas"), FontSize = 14, VerticalAlignment = VerticalAlignment.Center });
            var x = new TextBlock { Text = "", FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 10, Margin = new Thickness(12, 0, 0, 0), Foreground = (Brush)Win.FindResource("Sub"), VerticalAlignment = VerticalAlignment.Center, ToolTip = "Remover" };
            x.MouseLeftButtonUp += (s, e) => { var n = Amigos(); n.Remove(end); File.WriteAllLines(AmigosArq, n.ToArray()); ListaAmigos(); e.Handled = true; };
            sp.Children.Add(x); b.Content = sp;
            b.Click += (s, e) => { F<TextBox>("txtJoin").Text = end; Toast("Endereço: " + end); };
            w.Children.Add(b);
        }
    }

    // ---------- caçada
    void Hunt()
    {
        var p = F<StackPanel>("hpPanel");
        string[] k = { "1Player", "2Players", "3Players", "4Players" };
        for (int i = 0; i < 4; i++)
        {
            var g = new Grid { Margin = new Thickness(0, 6, 0, 6) };
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(260) });
            g.ColumnDefinitions.Add(new ColumnDefinition());
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(70) });
            g.Children.Add(new TextBlock { Text = (i + 1) + (i == 0 ? " caçador" : " caçadores"), Style = (Style)Win.FindResource("Lbl") });
            var sl = new Slider { Minimum = 0.1, Maximum = 3, SmallChange = 0.05, LargeChange = 0.1, TickFrequency = 0.05, IsSnapToTickEnabled = true, Margin = new Thickness(10, 0, 10, 0) };
            var v = new TextBlock { Style = (Style)Win.FindResource("Val") };
            Grid.SetColumn(sl, 1); Grid.SetColumn(v, 2); g.Children.Add(sl); g.Children.Add(v);
            SliderIni(sl, v, "Monster HP", k[i], 1.0, "0.00", "x");
            p.Children.Add(g);
        }
        Toggle("tgVillage", "Village Quests", "VillageQuestsInHub", "On");
        SliderIni(F<Slider>("slHubHp"), F<TextBlock>("vHubHp"), "Village Quests", "HubHP", 2.0, "0.0", "x");
        Toggle("tgBonus", "Bonus Content", "BonusContent", "On");
        Plugin("tgHpBar", "hintHp", NRO_HP);
        Plugin("tgDmg", "hintDmg", NRO_DMG);
    }

    // plugin .nro ligado = arquivo .nro; desligado = .nro.off (no mesmo lugar)
    string AcharPlugin(string nro)
    {
        // só nas pastas de plugins de cada mod (varrer os 12 mil arquivos da tradução travava a troca de página)
        string mods = Path.Combine(Dir, "mods");
        if (!Directory.Exists(mods)) return null;
        foreach (var m in Directory.GetDirectories(mods))
        {
            string pl = Path.Combine(m, "romfs", "nativeNX", "plugins");
            if (!Directory.Exists(pl)) continue;
            foreach (var cand in new[] { nro, nro + ".off" })
            {
                string f = Path.Combine(pl, cand);
                if (File.Exists(f)) return f;
            }
        }
        return null;
    }
    void Plugin(string toggle, string hint, string nro)
    {
        var t = F<CheckBox>(toggle);
        string f = AcharPlugin(nro);
        if (f == null) { t.IsEnabled = false; t.Opacity = 0.4; F<TextBlock>(hint).Text += " (plugin não instalado)"; return; }
        t.IsChecked = !f.EndsWith(".off");
        RoutedEventHandler h = (s, e) =>
        {
            string atual = AcharPlugin(nro); if (atual == null) return;
            bool on = t.IsChecked == true;
            string alvo = on ? (atual.EndsWith(".off") ? atual.Substring(0, atual.Length - 4) : atual) : (atual.EndsWith(".off") ? atual : atual + ".off");
            if (alvo != atual) File.Move(atual, alvo);
            Toast(on ? "Ligado" : "Desligado"); Resumo();
        };
        t.Checked += h; t.Unchecked += h;
    }

    // ---------- mods e cheats
    string ModsOn { get { return Path.Combine(Dir, "mods"); } }
    string ModsOff { get { return Path.Combine(Dir, "mods_desativados"); } }
    string Cheats { get { return Path.Combine(Dir, "cheats"); } }

    void Mods()
    {
        F<Button>("btnOpenMods").Click += (s, e) => Abrir(ModsOn);
        F<Button>("btnOpenCheats").Click += (s, e) => Abrir(Cheats);
        ListarMods();
    }
    UIElement Linha(string titulo, string sub, bool on, Action<bool> mudar)
    {
        var g = new Grid { Margin = new Thickness(0, 6, 0, 6) };
        var sp = new StackPanel { Margin = new Thickness(0, 0, 70, 0) };
        sp.Children.Add(new TextBlock { Text = titulo, Style = (Style)Win.FindResource("Lbl") });
        if (sub != null) sp.Children.Add(new TextBlock { Text = sub, Style = (Style)Win.FindResource("Hint") });
        g.Children.Add(sp);
        var t = new CheckBox { Style = (Style)Win.FindResource("Toggle"), IsChecked = on };
        RoutedEventHandler h = (s, e) => mudar(t.IsChecked == true);
        t.Checked += h; t.Unchecked += h;
        g.Children.Add(t);
        return g;
    }
    string Descricao(string pasta)
    {
        int arqs = 0; long bytes = 0; bool plugins = false;
        try
        {
            foreach (var f in Directory.EnumerateFiles(pasta, "*", SearchOption.AllDirectories)) { arqs++; bytes += new FileInfo(f).Length; if (f.EndsWith(".nro") || f.EndsWith(".nro.off")) plugins = true; }
        }
        catch { }
        string tam = bytes > 1L << 30 ? Num(bytes / (double)(1L << 30), "0.0") + " GB" : Num(bytes / (double)(1 << 20), "0") + " MB";
        return arqs + " arquivos · " + tam + (plugins ? " · plugins Forge" : "");
    }
    void ListarMods()
    {
        var p = F<StackPanel>("modsPanel"); p.Children.Clear();
        var lista = new List<Tuple<string, bool>>();
        if (Directory.Exists(ModsOn)) foreach (var d in Directory.GetDirectories(ModsOn)) lista.Add(Tuple.Create(d, true));
        if (Directory.Exists(ModsOff)) foreach (var d in Directory.GetDirectories(ModsOff)) lista.Add(Tuple.Create(d, false));
        foreach (var m in lista.OrderBy(x => Path.GetFileName(x.Item1)))
        {
            string nome = Path.GetFileName(m.Item1);
            string mostrar = nome == "HUD de Caca" ? "HUD de Caça (barra de vida + números de dano)" : nome;
            p.Children.Add(Linha(mostrar, Descricao(m.Item1), m.Item2, on =>
            {
                string a = Path.Combine(ModsOn, nome), b = Path.Combine(ModsOff, nome);
                try
                {
                    if (on && Directory.Exists(b)) { Directory.CreateDirectory(ModsOn); Directory.Move(b, a); }
                    if (!on && Directory.Exists(a)) { Directory.CreateDirectory(ModsOff); Directory.Move(a, b); }
                    Toast(on ? "Mod ligado" : "Mod desligado");
                }
                catch (Exception ex) { MessageBox.Show("Não consegui mover o mod (o jogo está aberto?)\n" + ex.Message, "MHGU Launcher"); }
                Resumo();
            }));
        }
        if (lista.Count == 0) p.Children.Add(new TextBlock { Text = "Nenhum mod. Cada mod é uma pasta com romfs dentro, em mods\\.", Style = (Style)Win.FindResource("Hint") });

        var c = F<StackPanel>("cheatsPanel"); c.Children.Clear();
        var cheats = Directory.Exists(Cheats) ? Directory.GetFiles(Cheats, "*.txt").OrderBy(x => x).ToArray() : new string[0];
        foreach (var f in cheats)
        {
            string n = Path.GetFileName(f).TrimStart('_');
            c.Children.Add(Linha(Path.GetFileNameWithoutExtension(n), null, !Path.GetFileName(f).StartsWith("_"), on =>
            {
                string a = Path.Combine(Cheats, n), b = Path.Combine(Cheats, "_" + n);
                if (on && File.Exists(b)) File.Move(b, a);
                if (!on && File.Exists(a)) File.Move(a, b);
                Toast(on ? "Cheat ligado" : "Cheat desligado");
            }));
        }
        if (cheats.Length == 0) c.Children.Add(new TextBlock { Text = "Nenhum cheat. Coloque arquivos .txt (Ryujinx/Atmosphère, versão 1.4.0) na pasta.", Style = (Style)Win.FindResource("Hint") });
    }

    void About()
    {
        F<Button>("btnOpenGame").Click += (s, e) => Abrir(Dir);
        F<Button>("btnOpenSave").Click += (s, e) => Abrir(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MHGURecomp", "save"));
        F<Button>("btnOpenShots").Click += (s, e) => Abrir(Path.Combine(Dir, "shots"));
        F<Button>("btnOpenLog").Click += (s, e) => { string l = Path.Combine(Dir, "log.txt"); if (File.Exists(l)) Process.Start("notepad.exe", "\"" + l + "\""); else Toast("Ainda sem log"); };
        F<Button>("btnResetIni").Click += (s, e) =>
        {
            if (MessageBox.Show("Voltar todas as configurações do port para o padrão?\n(o jogo recria o arquivo na próxima vez que abrir)", "MHGU Launcher", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            try { File.Copy(ini.Path, ini.Path + ".bak", true); File.Delete(ini.Path); } catch { }
            Process.Start(Application.ResourceAssembly.Location); Win.Close();
        };
    }

    // ---------- caçadores (lidos do save: cabeçalho de 0x24 bytes + estrutura do 3DS; slots em 0x34)
    class Cacador { public string Nome; public int Hr, Slot; public double Horas; public uint Zenny; }
    string SavePc { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "MHGURecomp", "save", "save_0", "system"); } }

    static List<Cacador> LerSave(string arq)
    {
        var r = new List<Cacador>();
        try
        {
            var d = File.ReadAllBytes(arq);
            if (d.Length < 0x40) return r;
            for (int i = 0; i < 3; i++)
            {
                if (d[0x28 + i] == 0) continue;                       // slot sem personagem
                int o = BitConverter.ToInt32(d, 0x34 + 4 * i) + 0x24;
                if (o <= 0 || o + 0x2C > d.Length) continue;
                int fim = Array.IndexOf(d, (byte)0, o, 32); if (fim < 0) fim = o + 32;
                string nome = Encoding.UTF8.GetString(d, o, fim - o).Trim();
                if (nome.Length == 0) continue;
                r.Add(new Cacador { Nome = nome, Slot = i + 1, Horas = BitConverter.ToUInt32(d, o + 0x20) / 3600.0, Zenny = BitConverter.ToUInt32(d, o + 0x24), Hr = BitConverter.ToUInt16(d, o + 0x28) });
            }
        }
        catch { }
        return r;
    }

    // saves do MHGU em emuladores (Eden, yuzu e derivados, Ryujinx)
    List<Tuple<string, string>> SavesEmuladores()
    {
        var r = new List<Tuple<string, string>>();
        string ad = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string[,] raizes = { { "Eden", "eden\\nand\\user\\save" }, { "yuzu", "yuzu\\nand\\user\\save" }, { "Citron", "citron\\nand\\user\\save" }, { "Sudachi", "sudachi\\nand\\user\\save" },
                             { "Suyu", "suyu\\nand\\user\\save" }, { "Torzu", "torzu\\nand\\user\\save" }, { "Ryujinx", "Ryujinx\\bis\\user\\save" } };
        for (int i = 0; i < raizes.GetLength(0); i++)
        {
            string raiz = Path.Combine(ad, raizes[i, 1]);
            if (!Directory.Exists(raiz)) continue;
            try
            {
                foreach (var f in Directory.EnumerateFiles(raiz, "system", SearchOption.AllDirectories))
                {
                    var tam = new FileInfo(f).Length;
                    if (tam < 5000000 || tam > 5400000) continue;
                    bool ehMhgu = f.IndexOf("0100770008DD8000", StringComparison.OrdinalIgnoreCase) >= 0 || raizes[i, 0] == "Ryujinx";
                    if (ehMhgu && LerSave(f).Count > 0) r.Add(Tuple.Create(raizes[i, 0], f));
                }
            }
            catch { }
        }
        return r.OrderByDescending(t => File.GetLastWriteTime(t.Item2)).ToList();
    }

    Tuple<string, string> emuAtual; bool importLigado;
    void Cacadores()
    {
        var pc = File.Exists(SavePc) ? LerSave(SavePc) : new List<Cacador>();
        var emus = SavesEmuladores();
        var mostrar = pc; string origem = "save do PC";
        if (pc.Count == 0 && emus.Count > 0) { mostrar = LerSave(emus[0].Item2); origem = "save do " + emus[0].Item1 + " (ainda não está no PC)"; }
        F<TextBlock>("txtSaveSrc").Text = mostrar.Count > 0 ? origem : "";
        F<TextBlock>("txtWelcome").Text = mostrar.Count > 0 ? "Bem-vindo, " + mostrar[0].Nome + "!" : "Bem-vindo, caçador!";
        if (mostrar.Count > 0) meuNome = mostrar[0].Nome;  // é assim que os amigos me veem
        if (amigosTimer != null) AtualizarMinhaResposta();

        var painel = F<UniformGrid>("huntersPanel"); painel.Children.Clear();
        foreach (var c in mostrar)
        {
            // Cartão de Guilda: selo de HR, nome em letras de guilda, horas e zenny
            var b = new Border { Background = (Brush)Win.FindResource("GlassBtn"), BorderBrush = (Brush)Win.FindResource("Rim"), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6), Padding = new Thickness(12, 10, 14, 10), Margin = new Thickness(6, 0, 6, 0) };
            var g = new Grid();
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(58) });
            g.ColumnDefinitions.Add(new ColumnDefinition());
            var selo = new Grid { Width = 48, Height = 48, HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Center };
            selo.Children.Add(new System.Windows.Shapes.Ellipse { Fill = new RadialGradientBrush(Color.FromRgb(0xEE, 0x6A, 0x43), Color.FromRgb(0x9A, 0x2E, 0x18)), Stroke = new SolidColorBrush(Color.FromRgb(0xF3, 0xC9, 0xA0)), StrokeThickness = 1.5 });
            var sv = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
            sv.Children.Add(new TextBlock { Text = "HR", FontFamily = (FontFamily)Win.FindResource("Display"), FontSize = 9, FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush(Color.FromRgb(0xFF, 0xE3, 0xCC)), HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, -3) });
            sv.Children.Add(new TextBlock { Text = c.Hr.ToString(), FontFamily = (FontFamily)Win.FindResource("Display"), FontSize = 18, FontWeight = FontWeights.Black, Foreground = new SolidColorBrush(Color.FromRgb(0xFF, 0xF4, 0xE6)), HorizontalAlignment = HorizontalAlignment.Center });
            selo.Children.Add(sv);
            g.Children.Add(selo);
            var sp = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; Grid.SetColumn(sp, 1);
            sp.Children.Add(new TextBlock { Text = "Cartão de Guilda · " + c.Slot + "º personagem", FontFamily = (FontFamily)Win.FindResource("Display"), FontSize = 10.5, FontWeight = FontWeights.Bold, Foreground = new SolidColorBrush(Color.FromRgb(0xC9, 0xAE, 0x8E)) });
            sp.Children.Add(new TextBlock { Text = c.Nome, FontFamily = (FontFamily)Win.FindResource("Display"), FontSize = 18, FontWeight = FontWeights.Black, TextTrimming = TextTrimming.CharacterEllipsis, Margin = new Thickness(0, 1, 0, 1) });
            sp.Children.Add(new TextBlock { Text = (c.Horas < 1 ? (int)(c.Horas * 60) + " min" : Num(c.Horas, "0.#") + " h") + " de caça  ·  " + c.Zenny.ToString("N0", new CultureInfo("pt-BR")) + " z", FontSize = 13, Foreground = (Brush)Win.FindResource("Sub") });
            g.Children.Add(sp);
            b.Child = g; painel.Children.Add(b);
        }
        if (mostrar.Count == 0) painel.Children.Add(new TextBlock { Text = "Nenhum caçador ainda. Crie um no jogo ou importe seu save do Switch/emulador.", Style = (Style)Win.FindResource("Hint"), Margin = new Thickness(6, 0, 6, 0) });

        // importar do emulador: quando o PC não tem caçador, ou o save do emulador é mais novo
        var box = F<Border>("importBox"); box.Visibility = Visibility.Collapsed;
        if (emus.Count == 0) return;
        var emu = emus[0]; emuAtual = emu;
        bool maisNovo = File.Exists(SavePc) && File.GetLastWriteTime(emu.Item2) > File.GetLastWriteTime(SavePc).AddMinutes(1);
        if (pc.Count > 0 && !maisNovo) return;
        var nomes = string.Join(", ", LerSave(emu.Item2).Select(c => c.Nome + " (HR " + c.Hr + ")"));
        F<TextBlock>("txtImport").Text = (pc.Count == 0 ? "Achei seu save do " : "O save do " ) + emu.Item1 + (pc.Count == 0 ? ": " : " é mais novo que o do PC: ") + nomes + ". Quer continuar de onde parou no PC?";
        box.Visibility = Visibility.Visible;
        F<TextBlock>("txtImport").Tag = nomes;
        if (importLigado) return; importLigado = true;
        F<Button>("btnImport").Click += (s, e) =>
        {
            var emu2 = emuAtual; string nomes2 = (string)F<TextBlock>("txtImport").Tag;
            if (Process.GetProcessesByName("mhgurecomp").Length > 0) { MessageBox.Show("Feche o jogo antes de importar o save.", "MHGU Launcher"); return; }
            if (MessageBox.Show("Copiar o save do " + emu2.Item1 + " para o PC?\n\n" + nomes2 + "\n\nO save atual do PC vai para uma pasta de backup.", "MHGU Launcher", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            try
            {
                string dest = Path.GetDirectoryName(SavePc), orig = Path.GetDirectoryName(emu2.Item2);
                if (Directory.Exists(dest))
                {
                    string bk = dest + "_backup_" + DateTime.Now.ToString("yyyyMMdd_HHmmss");
                    Directory.CreateDirectory(bk);
                    foreach (var f in Directory.GetFiles(dest)) File.Copy(f, Path.Combine(bk, Path.GetFileName(f)));
                }
                Directory.CreateDirectory(dest);
                foreach (var n in new[] { "system", "system_backup" })
                    if (File.Exists(Path.Combine(orig, n))) File.Copy(Path.Combine(orig, n), Path.Combine(dest, n), true);
                Toast("Save importado");
                Cacadores();
            }
            catch (Exception ex) { MessageBox.Show("Não consegui copiar o save: " + ex.Message, "MHGU Launcher"); }
        };
    }

    // ---------- versão do port e atualização (releases do GitHub)
    const string RELEASES = "https://api.github.com/repos/morerokk/MHGURecomp/releases/latest";
    string VersaoArq { get { return Path.Combine(Dir, "versao_port.txt"); } }
    string VersaoInstalada() { try { return File.Exists(VersaoArq) ? File.ReadAllText(VersaoArq).Trim() : null; } catch { return null; } }
    string novaVersao, novaUrl; bool atualizando;

    // o mhgurecomp.exe desta pasta está rodando? (outra instalação aberta não tranca estes arquivos)
    bool JogoAberto()
    {
        string meu = Path.GetFullPath(Path.Combine(Dir, "mhgurecomp.exe"));
        foreach (var p in Process.GetProcessesByName("mhgurecomp"))
        {
            try { if (string.Equals(Path.GetFullPath(p.MainModule.FileName), meu, StringComparison.OrdinalIgnoreCase)) return true; }
            catch { return true; }
        }
        return false;
    }

    static Version V(string s) { Version v; return s != null && Version.TryParse(s.Trim().TrimStart('v', 'V'), out v) ? v : null; }

    void Versao()
    {
        F<Button>("btnUpdate").Click += async (s, e) =>
        {
            if (novaUrl != null) await Atualizar();
            else if (licasUrl != null) await AplicarCorrecoes();
            else { await ProcurarVersao(); await ProcurarLauncher(); }
        };
        F<Button>("btnUpdHome").Click += async (s, e) => { if (novaUrl != null) await Atualizar(); else await AplicarCorrecoes(); };
        MostrarVersao();
        var _ = ProcurarVersao();
    }

    // correções nossas por cima do port oficial: mhgurecomp.exe recompilado com o código aberto do port
    // (Release do repositório do launcher com o arquivo mhgurecomp-<versão oficial>-licas<N>.exe)
    string LicasArq { get { return Path.Combine(Dir, "versao_licas.txt"); } }
    int LicasInstalado() { int n; try { return File.Exists(LicasArq) && int.TryParse(File.ReadAllText(LicasArq).Trim(), out n) ? n : 0; } catch { return 0; } }
    string licasUrl; int licasNum;

    string VersaoCompleta()
    {
        string v = VersaoInstalada(); int l = LicasInstalado();
        return v == null ? null : v + (l > 0 ? "-licas" + l : "");
    }

    void MostrarVersao()
    {
        string v = VersaoCompleta();
        F<TextBlock>("txtVer").Text = "MHGURecomp " + (v ?? "(versão desconhecida)") + (LicasInstalado() > 0 ? "  ·  com as correções do licas.mp3" : "");
        F<TextBlock>("txtVerOnline").Text = v ?? "?";
    }

    // chamado com o JSON do último Release do repositório do launcher
    void VerificarCorrecoes(string json)
    {
        licasUrl = null;
        string base_ = VersaoInstalada(); if (base_ == null || json == null) return;
        foreach (System.Text.RegularExpressions.Match m in System.Text.RegularExpressions.Regex.Matches(json, "\"browser_download_url\"\\s*:\\s*\"([^\"]*/mhgurecomp-([0-9.]+)-licas(\\d+)\\.exe)\""))
        {
            int n = int.Parse(m.Groups[3].Value);
            if (m.Groups[2].Value == base_ && n > LicasInstalado() && n > licasNum) { licasUrl = m.Groups[1].Value; licasNum = n; }
        }
        if (licasUrl == null || novaUrl != null) return;  // (atualização oficial primeiro; as correções vêm depois dela)
        F<TextBlock>("txtUpdTitle").Text = "Correções do port disponíveis: " + base_ + "-licas" + licasNum;
        F<TextBlock>("txtUpdSub").Text = "Consertos feitos por licas.mp3 em cima do port oficial (ex.: sincronia dos monstros pequenos). Seu grupo deve usar a mesma versão.";
        F<Border>("updBox").Visibility = Visibility.Visible;
        F<Button>("btnUpdate").Content = "Aplicar correções";
        F<TextBlock>("txtVerSub").Text = "Correções disponíveis: " + base_ + "-licas" + licasNum + ".";
        F<TextBlock>("txtVerSub").Foreground = (Brush)Win.FindResource("GoldHi");
    }

    async Task AplicarCorrecoes()
    {
        if (atualizando || licasUrl == null) return;
        if (JogoAberto()) { MessageBox.Show("Feche o jogo antes de atualizar o port.", "MHGU Launcher"); return; }
        atualizando = true;
        var b1 = F<Button>("btnUpdate"); var b2 = F<Button>("btnUpdHome");
        b1.IsEnabled = b2.IsEnabled = false;
        string novo = Path.Combine(Dir, "mhgurecomp.exe.novo"), exe = Path.Combine(Dir, "mhgurecomp.exe");
        try
        {
            var wc = new WebClient(); wc.Headers.Add("User-Agent", "MHGU-Launcher");
            wc.DownloadProgressChanged += (s, e) => { b1.Content = "Baixando " + e.ProgressPercentage + "%"; b2.Content = b1.Content; };
            await wc.DownloadFileTaskAsync(licasUrl, novo);
            var bytes = File.ReadAllBytes(novo);
            if (bytes.Length < 1000000 || bytes[0] != 'M' || bytes[1] != 'Z') throw new Exception("o arquivo baixado não é um programa válido");
            Directory.CreateDirectory(Path.Combine(Dir, "port_anterior"));
            File.Copy(exe, Path.Combine(Dir, "port_anterior", "mhgurecomp.exe"), true);
            File.Copy(novo, exe, true); File.Delete(novo);
            File.WriteAllText(LicasArq, licasNum.ToString());
            licasUrl = null;
            MostrarVersao();
            F<Border>("updBox").Visibility = Visibility.Collapsed;
            F<TextBlock>("txtVerSub").Text = "Correções aplicadas: " + VersaoCompleta() + " (o exe anterior está em port_anterior).";
            F<TextBlock>("txtVerSub").Foreground = (Brush)Win.FindResource("Ok");
            Toast("Port atualizado: " + VersaoCompleta());
        }
        catch (Exception ex)
        {
            try { if (File.Exists(novo)) File.Delete(novo); } catch { }
            MessageBox.Show("Não consegui aplicar as correções: " + ex.Message + "\n\nO port continua como estava.", "MHGU Launcher");
        }
        finally
        {
            atualizando = false; b1.IsEnabled = b2.IsEnabled = true;
            b1.Content = licasUrl != null ? "Aplicar correções" : "Procurar de novo"; b2.Content = "Atualizar agora";
        }
    }

    async Task ProcurarVersao()
    {
        var sub = F<TextBlock>("txtVerSub");
        sub.Text = "Procurando atualização..."; sub.Foreground = (Brush)Win.FindResource("Sub");
        string json = null;
        try
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            var wc = new WebClient(); wc.Headers.Add("User-Agent", "MHGU-Launcher");
            json = await wc.DownloadStringTaskAsync(RELEASES);
        }
        catch { }
        if (json == null) { sub.Text = "Sem internet agora: não deu para procurar atualização."; return; }
        var tag = System.Text.RegularExpressions.Regex.Match(json, "\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
        var url = System.Text.RegularExpressions.Regex.Match(json, "\"browser_download_url\"\\s*:\\s*\"([^\"]*Windows[^\"]*\\.zip)\"");
        if (!tag.Success || !url.Success) { sub.Text = "Não entendi a resposta do GitHub."; return; }
        string ultima = tag.Groups[1].Value, instalada = VersaoInstalada();
        bool nova = V(instalada) == null || V(ultima) > V(instalada);
        novaVersao = nova ? ultima : null; novaUrl = nova ? url.Groups[1].Value : null;
        F<Button>("btnUpdate").Content = nova ? "Atualizar para " + ultima : "Procurar de novo";
        if (!nova)
        {
            sub.Text = "Você está na versão mais nova."; sub.Foreground = (Brush)Win.FindResource("Ok");
            F<Border>("updBox").Visibility = Visibility.Collapsed;
            VerificarCorrecoes(jsonLauncher);
            return;
        }
        sub.Text = "Nova versão disponível: " + ultima + "."; sub.Foreground = (Brush)Win.FindResource("GoldHi");
        F<TextBlock>("txtUpdTitle").Text = "Atualização do port disponível: " + ultima;
        F<TextBlock>("txtUpdSub").Text = (instalada != null ? "Você tem a " + instalada + ". " : "") + "Correções do autor do port. Seu grupo deve usar a mesma versão.";
        F<Border>("updBox").Visibility = Visibility.Visible;
    }

    async Task Atualizar()
    {
        if (atualizando || novaUrl == null) return;
        if (JogoAberto()) { MessageBox.Show("Feche o jogo antes de atualizar o port.", "MHGU Launcher"); return; }
        atualizando = true;
        var b1 = F<Button>("btnUpdate"); var b2 = F<Button>("btnUpdHome");
        b1.IsEnabled = b2.IsEnabled = false;
        Action<string> status = t => { b1.Content = t; b2.Content = t; };
        string tmp = Path.Combine(Path.GetTempPath(), "mhgu_atualizacao");
        try
        {
            if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
            Directory.CreateDirectory(tmp);
            string zip = Path.Combine(tmp, "port.zip");
            var wc = new WebClient(); wc.Headers.Add("User-Agent", "MHGU-Launcher");
            wc.DownloadProgressChanged += (s, e) => status("Baixando " + e.ProgressPercentage + "%");
            await wc.DownloadFileTaskAsync(novaUrl, zip);
            status("Instalando...");
            string versao = novaVersao;
            int trocados = await Task.Run(() =>
            {
                string x = Path.Combine(tmp, "x");
                System.IO.Compression.ZipFile.ExtractToDirectory(zip, x);
                string raiz = Directory.GetFiles(x, "mhgurecomp.exe", SearchOption.AllDirectories).Select(Path.GetDirectoryName).FirstOrDefault();
                if (raiz == null) throw new Exception("o zip baixado não tem o mhgurecomp.exe");
                int n = 0;
                // só os arquivos do port: nunca o .ini, o jogo (data), os mods, os cheats ou os saves
                foreach (var f in Directory.GetFiles(raiz))
                {
                    string nome = Path.GetFileName(f);
                    if (nome.Equals("mhgurecomp.ini", StringComparison.OrdinalIgnoreCase)) continue;
                    string alvo = Path.Combine(Dir, nome);
                    if (File.Exists(alvo) && new FileInfo(alvo).Length == new FileInfo(f).Length && File.ReadAllBytes(alvo).SequenceEqual(File.ReadAllBytes(f))) continue;
                    if (File.Exists(alvo)) { Directory.CreateDirectory(Path.Combine(Dir, "port_anterior")); File.Copy(alvo, Path.Combine(Dir, "port_anterior", nome), true); }
                    File.Copy(f, alvo, true); n++;
                }
                string bonus = Path.Combine(raiz, "bonus", "system"), bonusAlvo = Path.Combine(Dir, "bonus", "system");
                if (File.Exists(bonus) && !File.Exists(bonusAlvo)) { Directory.CreateDirectory(Path.GetDirectoryName(bonusAlvo)); File.Copy(bonus, bonusAlvo); }
                File.WriteAllText(VersaoArq, versao);
                if (File.Exists(LicasArq)) File.Delete(LicasArq);  // o exe oficial substituiu o nosso
                return n;
            });
            novaUrl = null; novaVersao = null;
            MostrarVersao();
            F<Border>("updBox").Visibility = Visibility.Collapsed;
            VerificarCorrecoes(jsonLauncher);  // correções para a versão nova, se já houver
            Toast("Port atualizado para " + versao);
            F<TextBlock>("txtVerSub").Text = "Atualizado para " + versao + " (" + trocados + " arquivo(s) trocado(s); os antigos estão em port_anterior).";
            F<TextBlock>("txtVerSub").Foreground = (Brush)Win.FindResource("Ok");
        }
        catch (Exception ex)
        {
            MessageBox.Show("Não consegui atualizar o port: " + ex.Message + "\n\nNada do jogo foi apagado.", "MHGU Launcher");
        }
        finally
        {
            try { Directory.Delete(tmp, true); } catch { }
            atualizando = false; b1.IsEnabled = b2.IsEnabled = true;
            b1.Content = novaUrl != null ? "Atualizar para " + novaVersao : "Procurar de novo"; b2.Content = "Atualizar agora";
        }
    }

    // ---------- atualização do próprio launcher (Releases do repositório do launcher)
    string selfUrl, selfVersao, selfNotas, jsonLauncher; bool selfAtualizando;
    string LauncherExe { get { return Process.GetCurrentProcess().MainModule.FileName; } }
    string NovidadesArq { get { return Path.Combine(Dir, "launcher_novidades.txt"); } }

    void AutoUpdate(string[] args)
    {
        F<TextBlock>("txtLauncherVer").Text = "Generations Ultimate";
        F<TextBlock>("txtSelfVer").Text = "MHGU Launcher v" + VERSAO;
        F<Button>("btnSelfUpd").Click += async (s, e) => await AtualizarLauncher();
        F<Button>("btnSelfCheck").Click += async (s, e) => { if (selfUrl != null) await AtualizarLauncher(); else await ProcurarLauncher(); };
        F<Button>("btnNewsClose").Click += (s, e) => { F<Border>("newsBox").Visibility = Visibility.Collapsed; try { File.Delete(NovidadesArq); } catch { } };

        // restos da troca anterior (o exe antigo só pode ser apagado depois que fechou)
        foreach (var f in Directory.GetFiles(Dir, "MHGU Launcher.old*.exe")) { try { File.Delete(f); } catch { } }

        // acabou de atualizar: mostra as novidades uma vez
        if (File.Exists(NovidadesArq))
        {
            try
            {
                var linhas = File.ReadAllLines(NovidadesArq, Encoding.UTF8);
                if (linhas.Length > 0 && linhas[0] == VERSAO)
                {
                    F<TextBlock>("txtNewsTitle").Text = "Atualizado para a v" + VERSAO + " · novidades";
                    F<TextBlock>("txtNews").Text = string.Join("\n", linhas.Skip(1)).Trim();
                    if (F<TextBlock>("txtNews").Text.Length == 0) F<TextBlock>("txtNews").Text = "Launcher atualizado.";
                    F<Border>("newsBox").Visibility = Visibility.Visible;
                }
                else File.Delete(NovidadesArq);
            }
            catch { }
        }
        // teste: --teste-autoupdate <exe> simula um Release com esse arquivo
        int it = Array.IndexOf(args, "--teste-autoupdate");
        if (it >= 0 && it + 1 < args.Length)
        {
            selfUrl = new Uri(Path.GetFullPath(args[it + 1])).AbsoluteUri; selfVersao = VERSAO;
            selfNotas = "- Teste de atualização automática\n- Segunda linha de novidades";
            Win.ContentRendered += async (s, e) => await AtualizarLauncher();
            return;
        }
        var _ = ProcurarLauncher();
    }

    static string JsonTexto(string json, string chave)
    {
        var m = System.Text.RegularExpressions.Regex.Match(json, "\"" + chave + "\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
        if (!m.Success) return null;
        return System.Text.RegularExpressions.Regex.Unescape(m.Groups[1].Value);
    }

    async Task ProcurarLauncher()
    {
        var sub = F<TextBlock>("txtSelfVerSub");
        sub.Text = "Procurando atualização..."; sub.Foreground = (Brush)Win.FindResource("Sub");
        string json = null;
        try
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            var wc = new WebClient(); wc.Headers.Add("User-Agent", "MHGU-Launcher");
            json = await wc.DownloadStringTaskAsync("https://api.github.com/repos/" + REPO_LAUNCHER + "/releases/latest");
        }
        catch (WebException ex)
        {
            var r = ex.Response as HttpWebResponse;
            sub.Text = r != null && r.StatusCode == HttpStatusCode.NotFound ? "Ainda não há versões publicadas no GitHub." : "Sem internet agora: não deu para procurar atualização.";
            return;
        }
        catch { sub.Text = "Não deu para procurar atualização."; return; }
        jsonLauncher = json;
        VerificarCorrecoes(json);
        string tag = JsonTexto(json, "tag_name");
        // o .exe do launcher anexado ao Release (o GitHub troca espaços por pontos no nome)
        var asset = System.Text.RegularExpressions.Regex.Match(json, "\"browser_download_url\"\\s*:\\s*\"([^\"]*Launcher[^\"]*\\.exe)\"", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (tag == null || V(tag) == null) { sub.Text = "O último Release não tem uma versão válida (use uma tag como v2.2.0)."; return; }
        if (V(tag) <= V(VERSAO)) { sub.Text = "Você está na versão mais nova."; sub.Foreground = (Brush)Win.FindResource("Ok"); selfUrl = null; F<Button>("btnSelfCheck").Content = "Procurar de novo"; return; }
        if (!asset.Success) { sub.Text = "A versão " + tag + " saiu, mas o Release não tem o .exe do launcher anexado."; return; }
        selfUrl = asset.Groups[1].Value; selfVersao = tag.TrimStart('v', 'V'); selfNotas = JsonTexto(json, "body") ?? "";
        sub.Text = "Nova versão disponível: v" + selfVersao + "."; sub.Foreground = (Brush)Win.FindResource("GoldHi");
        F<Button>("btnSelfCheck").Content = "Atualizar para v" + selfVersao;
        F<TextBlock>("txtSelfTitle").Text = "Nova versão do launcher: v" + selfVersao;
        string resumo = selfNotas.Replace("\r", "").Split('\n').Select(l => l.Trim().TrimStart('-', '*', '#', ' ')).FirstOrDefault(l => l.Length > 0);
        F<TextBlock>("txtSelfSub").Text = "Você tem a v" + VERSAO + "." + (resumo != null ? " Novidade: " + resumo : "") + " Leva poucos segundos.";
        F<Border>("selfBox").Visibility = Visibility.Visible;
    }

    async Task AtualizarLauncher()
    {
        if (selfAtualizando || selfUrl == null) return;
        selfAtualizando = true;
        var b1 = F<Button>("btnSelfUpd"); var b2 = F<Button>("btnSelfCheck");
        b1.IsEnabled = b2.IsEnabled = false;
        string atual = LauncherExe, novo = atual + ".novo";
        try
        {
            SalvarAgora();
            var wc = new WebClient(); wc.Headers.Add("User-Agent", "MHGU-Launcher");
            wc.DownloadProgressChanged += (s, e) => { b1.Content = "Baixando " + e.ProgressPercentage + "%"; b2.Content = b1.Content; };
            await wc.DownloadFileTaskAsync(selfUrl, novo);
            var bytes = File.ReadAllBytes(novo);
            if (bytes.Length < 100000 || bytes[0] != 'M' || bytes[1] != 'Z') throw new Exception("o arquivo baixado não é um programa válido");
            // o Windows deixa renomear um exe em uso: o atual vira .old, o novo assume o nome (atalho continua valendo)
            string velho = Path.Combine(Dir, "MHGU Launcher.old.exe");
            if (File.Exists(velho)) { try { File.Delete(velho); } catch { velho = Path.Combine(Dir, "MHGU Launcher.old" + DateTime.Now.Ticks + ".exe"); } }
            File.Move(atual, velho);
            File.Move(novo, atual);
            File.WriteAllText(NovidadesArq, selfVersao + "\n" + selfNotas, new UTF8Encoding(false));
            Process.Start(new ProcessStartInfo(atual) { WorkingDirectory = Dir, UseShellExecute = true });
            Win.Close();
        }
        catch (Exception ex)
        {
            try { if (File.Exists(novo)) File.Delete(novo); } catch { }
            MessageBox.Show("Não consegui atualizar o launcher: " + ex.Message, "MHGU Launcher");
            b1.Content = "Atualizar launcher"; b2.Content = "Atualizar para v" + selfVersao;
        }
        finally { selfAtualizando = false; b1.IsEnabled = b2.IsEnabled = true; }
    }

    // ---------- amigos online: cada launcher responde, na porta do jogo + 1 (UDP), quem é e o que está fazendo.
    // Pergunta "MHGU?1"; resposta "MHGU!1|nome|versão do port|versão do launcher|sincronia|estado" (L launcher, J jogando, H Hub aberto)
    class Status { public bool Online; public long Ping; public string Nome, Port, Launcher, Sync, Estado; }
    System.Net.Sockets.UdpClient presenca; volatile string minhaResposta = ""; string meuNome = "Caçador"; bool presencaOk;
    readonly Dictionary<string, Status> statusAmigos = new Dictionary<string, Status>();
    DispatcherTimer amigosTimer; bool consultando;

    int PortaJogo() { int p; return int.TryParse(ini.Get("Multiplayer", "Port", "39500"), out p) && p > 0 && p < 65535 ? p : 39500; }

    void Presenca()
    {
        try
        {
            presenca = new System.Net.Sockets.UdpClient(new IPEndPoint(IPAddress.Any, PortaJogo() + 1));
            presencaOk = true;
            var th = new System.Threading.Thread(() =>
            {
                while (true)
                {
                    try
                    {
                        IPEndPoint de = null;
                        var d = presenca.Receive(ref de);
                        if (d.Length != 6 || Encoding.ASCII.GetString(d) != "MHGU?1") continue;  // só a pergunta exata
                        var r = Encoding.UTF8.GetBytes(minhaResposta);
                        presenca.Send(r, r.Length, de);
                    }
                    catch (ObjectDisposedException) { return; }
                    catch { }
                }
            }) { IsBackground = true, Name = "presenca" };
            th.Start();
        }
        catch { presencaOk = false; }  // (porta ocupada: outro launcher aberto)

        var txt = F<TextBox>("txtNovoAmigo");
        txt.TextChanged += (s, e) => F<TextBlock>("hintNovoAmigo").Visibility = txt.Text.Length > 0 ? Visibility.Collapsed : Visibility.Visible;
        Action add = () =>
        {
            string a = txt.Text.Trim(); if (a.Length == 0) return;
            var l = Amigos(); if (!l.Contains(a)) { l.Add(a); File.WriteAllLines(AmigosArq, l.ToArray()); }
            txt.Text = ""; Toast("Amigo adicionado"); ListaAmigos(); MontarAmigos(); var _ = ConsultarAmigos();
        };
        F<Button>("btnAddAmigo").Click += (s, e) => add();
        txt.KeyDown += (s, e) => { if (e.Key == Key.Enter) add(); };

        AtualizarMinhaResposta();
        amigosTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        int volta = 0;
        amigosTimer.Tick += async (s, e) =>
        {
            AtualizarMinhaResposta();
            // na página Online a cada 3 s; no resto a cada 15 s (para o resumo do Início)
            bool naPagina = F<FrameworkElement>("pgOnline").Visibility == Visibility.Visible;
            if (naPagina || ++volta % 5 == 0) await ConsultarAmigos();
        };
        Win.Loaded += async (s, e) => { MontarAmigos(); amigosTimer.Start(); await ConsultarAmigos(); };
        Win.Closed += (s, e) => { try { presenca.Close(); } catch { } };
    }

    // o que os amigos veem de mim
    void AtualizarMinhaResposta()
    {
        bool jogando = JogoAberto(), hub = false;
        if (jogando)
            try { hub = IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners().Any(ep => ep.Port == PortaJogo()); } catch { }
        string nome = (meuNome ?? "Caçador").Replace("|", "/");
        minhaResposta = "MHGU!1|" + nome + "|" + (VersaoCompleta() ?? "?") + "|" + VERSAO + "|" + ini.Get("Multiplayer", "SyncSmallMonsters", "On") + "|" + (hub ? "H" : jogando ? "J" : "L");
        F<TextBlock>("txtMeuStatus").Text = presencaOk ? "Você aparece como " + nome : "Presença desligada (outro launcher já está aberto)";
        F<System.Windows.Shapes.Ellipse>("meuPonto").Fill = (Brush)Win.FindResource(presencaOk ? "Ok" : "Sub");
    }

    static async Task<Status> Consultar(string endereco, int portaPadrao)
    {
        string host = endereco; int porta = portaPadrao;
        int c = endereco.LastIndexOf(':');
        if (c > 0 && int.TryParse(endereco.Substring(c + 1), out porta)) host = endereco.Substring(0, c); else porta = portaPadrao;
        var st = new Status();
        try
        {
            using (var u = new System.Net.Sockets.UdpClient())
            {
                var pergunta = Encoding.ASCII.GetBytes("MHGU?1");
                // duas medidas: a primeira inclui o preparo do socket; vale a menor.
                // uma espera que passou do tempo continua valendo na tentativa seguinte (senão ela "rouba" a resposta)
                Task<System.Net.Sockets.UdpReceiveResult> rec = null;
                for (int tentativa = 0; tentativa < 3 && !(st.Online && tentativa >= 2); tentativa++)
                {
                    var sw = Stopwatch.StartNew();
                    await u.SendAsync(pergunta, pergunta.Length, host, porta + 1);
                    if (rec == null) rec = u.ReceiveAsync();
                    if (await Task.WhenAny(rec, Task.Delay(1200)) != rec) continue;
                    var chegou = rec; rec = null;
                    if (chegou.IsFaulted) continue;
                    var partes = Encoding.UTF8.GetString(chegou.Result.Buffer).Split('|');
                    if (partes.Length < 6 || partes[0] != "MHGU!1") continue;
                    long ms = sw.ElapsedMilliseconds;
                    st.Ping = st.Online ? Math.Min(st.Ping, ms) : ms; st.Online = true;
                    st.Nome = partes[1]; st.Port = partes[2]; st.Launcher = partes[3]; st.Sync = partes[4]; st.Estado = partes[5];
                }
            }
        }
        catch { }
        return st;
    }

    async Task ConsultarAmigos()
    {
        if (consultando) return; consultando = true;
        try
        {
            // cada amigo aparece assim que responde (um amigo offline não segura os outros)
            var lista = Amigos(); int porta = PortaJogo();
            await Task.WhenAll(lista.Select(async a =>
            {
                var st = await Consultar(a, porta);
                statusAmigos[a] = st;
                MontarAmigos(); Resumo();
            }));
        }
        finally { consultando = false; }
    }

    void MontarAmigos()
    {
        var p = F<StackPanel>("amigosList"); p.Children.Clear();
        var lista = Amigos();
        F<TextBlock>("txtSemAmigos").Visibility = lista.Count == 0 ? Visibility.Visible : Visibility.Collapsed;
        string minhaVersao = VersaoCompleta() ?? "?", meuSync = ini.Get("Multiplayer", "SyncSmallMonsters", "On");
        var sub = (Brush)Win.FindResource("Sub");
        for (int i = 0; i < lista.Count; i++)
        {
            string end = lista[i];
            Status st; statusAmigos.TryGetValue(end, out st);
            bool online = st != null && st.Online;
            if (i > 0) p.Children.Add(new System.Windows.Shapes.Rectangle { Height = 1, Fill = (Brush)Win.FindResource("Line"), Margin = new Thickness(50, 0, -18, 0) });
            var g = new Grid { Margin = new Thickness(0, 9, 0, 9) };
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(50) });
            g.ColumnDefinitions.Add(new ColumnDefinition());
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            // avatar com a inicial e o pontinho de status
            string nome = online && !string.IsNullOrWhiteSpace(st.Nome) ? st.Nome : end;
            var av = new Grid { Width = 38, Height = 38, HorizontalAlignment = HorizontalAlignment.Left };
            av.Children.Add(new Border { CornerRadius = new CornerRadius(19), Background = (Brush)Win.FindResource("GlassBtn"), BorderBrush = (Brush)Win.FindResource("Rim"), BorderThickness = new Thickness(1) });
            av.Children.Add(new TextBlock { Text = online ? nome.Substring(0, 1).ToUpper() : "?", FontFamily = (FontFamily)Win.FindResource("Display"), FontSize = 16, FontWeight = FontWeights.Bold, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center });
            Brush cor = !online ? new SolidColorBrush(Color.FromRgb(0x63, 0x63, 0x66)) : st.Estado == "H" ? (Brush)Win.FindResource("Ok") : st.Estado == "J" ? new SolidColorBrush(Color.FromRgb(0x0A, 0x84, 0xFF)) : (Brush)Win.FindResource("Ok");
            av.Children.Add(new System.Windows.Shapes.Ellipse { Width = 11, Height = 11, Fill = cor, Stroke = (Brush)Win.FindResource("Bg"), StrokeThickness = 2, HorizontalAlignment = HorizontalAlignment.Right, VerticalAlignment = VerticalAlignment.Bottom });
            g.Children.Add(av);

            var info = new StackPanel { VerticalAlignment = VerticalAlignment.Center }; Grid.SetColumn(info, 1);
            info.Children.Add(new TextBlock { Text = nome, FontSize = 14, FontWeight = FontWeights.SemiBold, TextTrimming = TextTrimming.CharacterEllipsis });
            string estado = !online ? "Offline · " + end : st.Estado == "H" ? "Hub aberto · jogando" : st.Estado == "J" ? "Jogando" : "No launcher";
            info.Children.Add(new TextBlock { Text = estado + (online ? " · " + end : ""), FontSize = 12, Foreground = sub, TextTrimming = TextTrimming.CharacterEllipsis });
            if (online)
            {
                var avisos = new List<string>();
                if (st.Port != minhaVersao) avisos.Add("port diferente (dele " + st.Port + ", seu " + minhaVersao + ")");
                if (!string.Equals(st.Sync, meuSync, StringComparison.OrdinalIgnoreCase)) avisos.Add("sincronia de monstros pequenos diferente");
                if (avisos.Count > 0) info.Children.Add(new TextBlock { Text = "⚠ " + string.Join(" · ", avisos), FontSize = 12, Foreground = (Brush)Win.FindResource("Bad"), TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 2, 0, 0) });
            }
            g.Children.Add(info);

            if (online)
            {
                var pg = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10, 0, 12, 0) }; Grid.SetColumn(pg, 2);
                var corPing = st.Ping < 60 ? Color.FromRgb(0x30, 0xD1, 0x58) : st.Ping < 130 ? Color.FromRgb(0xFF, 0xD6, 0x0A) : Color.FromRgb(0xFF, 0x45, 0x3A);
                pg.Children.Add(new System.Windows.Shapes.Ellipse { Width = 7, Height = 7, Fill = new SolidColorBrush(corPing), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 6, 0) });
                pg.Children.Add(new TextBlock { Text = st.Ping + " ms", FontSize = 12.5, Foreground = sub, VerticalAlignment = VerticalAlignment.Center });
                g.Children.Add(pg);
            }

            var entrar = new Button { Content = online && st.Estado == "H" ? "Entrar no Hub" : "Entrar", Style = (Style)Win.FindResource("Btn"), VerticalAlignment = VerticalAlignment.Center, MinWidth = 96, IsEnabled = online };
            if (online && st.Estado == "H") { entrar.Background = (Brush)Win.FindResource("Ember"); entrar.Foreground = new SolidColorBrush(Color.FromRgb(0xFF, 0xF4, 0xE6)); entrar.FontWeight = FontWeights.SemiBold; }
            entrar.ToolTip = online ? "Configura o endereço dele e abre o jogo" : "Ele precisa estar com o launcher aberto";
            entrar.Click += (s, e) => EntrarNoHub(end);
            Grid.SetColumn(entrar, 3); g.Children.Add(entrar);

            var x = new Button { Content = "", Style = (Style)Win.FindResource("IconBtn"), Margin = new Thickness(6, 0, 0, 0), ToolTip = "Remover", Foreground = sub, VerticalAlignment = VerticalAlignment.Center };
            x.Click += (s, e) => { var n = Amigos(); n.Remove(end); File.WriteAllLines(AmigosArq, n.ToArray()); statusAmigos.Remove(end); MontarAmigos(); ListaAmigos(); Resumo(); };
            Grid.SetColumn(x, 4); g.Children.Add(x);
            p.Children.Add(g);
        }
    }

    void EntrarNoHub(string end)
    {
        F<RadioButton>("rbJoin").IsChecked = true;
        F<TextBox>("txtJoin").Text = end;
        ini.Set("Multiplayer", "Join", end);
        Toast("Entrando com " + end + ": no jogo, Jogo Local > Procurar Hubs");
        Jogar();
    }

    int AmigosOnline() { return statusAmigos.Count(kv => kv.Value.Online && Amigos().Contains(kv.Key)); }

    // ---------- perfis gráficos: Leve / Equilibrado / Ultra (montados pelo monitor; recomendado pela placa de vídeo)
    class Perfil { public string Nome, Render, Msaa; public bool Fxaa; public int Fps; }
    Perfil[] perfis; bool marcandoPerfil;

    void Perfis()
    {
        int hz = Hz();
        int alt = 1080; int.TryParse(Monitor().Split('x').Last(), out alt);
        perfis = new[]
        {
            new Perfil { Nome = "Leve",        Render = "1280x720", Msaa = "Off", Fxaa = true,  Fps = 60 },
            new Perfil { Nome = "Equilibrado", Render = "Auto",     Msaa = "2x",  Fxaa = true,  Fps = Math.Max(60, Math.Min(120, hz)) },
            new Perfil { Nome = "Ultra",       Render = alt <= 900 ? "2560x1440" : "3840x2160", Msaa = "8x", Fxaa = false, Fps = Math.Max(60, Math.Min(240, hz)) },
        };
        var resumo = new Dictionary<string, string> { { "1280x720", "720p" }, { "Auto", "resolução da tela" }, { "2560x1440", "1440p" }, { "3840x2160", "4K" } };
        foreach (var p in perfis)
        {
            var pf = p;
            F<TextBlock>("pfInfo" + p.Nome).Text = resumo[p.Render] + " · " + p.Fps + " FPS · " + (p.Msaa == "Off" ? "sem MSAA" : "MSAA " + p.Msaa);
            F<RadioButton>("pf" + p.Nome).Checked += (s, e) => { if (!marcandoPerfil) AplicarPerfil(pf); };
        }
        PerfilAtual();
        Win.Loaded += (s, e) => Recomendar();  // (async: depois da janela aberta)
    }

    void AplicarPerfil(Perfil p)
    {
        SelecionarCombo("cbRender", p.Render);
        SelecionarCombo("cbMsaa", p.Msaa);
        F<CheckBox>("tgFxaa").IsChecked = p.Fxaa;
        F<Slider>("slFps").Value = p.Fps;
        F<CheckBox>("tgVsync").IsChecked = true;
        Toast("Perfil " + p.Nome + " aplicado");
    }

    void SelecionarCombo(string nome, string tag)
    {
        var c = F<ComboBox>(nome);
        foreach (ComboBoxItem it in c.Items) if (string.Equals((string)it.Tag, tag, StringComparison.OrdinalIgnoreCase)) { c.SelectedItem = it; return; }
        var novo = new ComboBoxItem { Content = tag, Tag = tag }; c.Items.Add(novo); c.SelectedItem = novo;
    }

    // marca o perfil que bate com os ajustes atuais; nenhum = personalizado
    void PerfilAtual()
    {
        if (perfis == null) return;
        Perfil atual = null;
        foreach (var p in perfis)
            if (ini.Get("Display", "RenderResolution", "Auto").Equals(p.Render, StringComparison.OrdinalIgnoreCase)
                && ini.Get("Anti-aliasing", "MSAA", "Off").Equals(p.Msaa, StringComparison.OrdinalIgnoreCase)
                && On(ini.Get("Anti-aliasing", "FXAA", "On")) == p.Fxaa
                && ini.Get("Performance", "FPS", "60") == p.Fps.ToString()) atual = p;
        marcandoPerfil = true;
        foreach (var p in perfis) F<RadioButton>("pf" + p.Nome).IsChecked = p == atual;
        marcandoPerfil = false;
        perfilNome = atual != null ? atual.Nome : null;
        TextoPerfil();
    }

    string perfilNome, placaTexto, recomendado;
    void TextoPerfil()
    {
        string t = perfilNome == null ? "Personalizado: os ajustes abaixo não batem com nenhum perfil." : "Perfil " + perfilNome + " ativo. Dá para ajustar cada opção abaixo.";
        if (placaTexto != null) t += "  ·  Sua placa: " + placaTexto + (recomendado != null ? " → recomendado: " + recomendado : "");
        F<TextBlock>("txtPerfil").Text = t;
    }

    // placa de vídeo e memória (o registro tem o valor real; o WMI corta em 4 GB)
    async void Recomendar()
    {
        string nome = null; long vram = 0;
        await Task.Run(() =>
        {
            try
            {
                using (var k = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}"))
                    if (k != null)
                        foreach (var sub in k.GetSubKeyNames().Where(x => x.Length == 4))
                            using (var g = k.OpenSubKey(sub))
                            {
                                if (g == null) continue;
                                object m = g.GetValue("HardwareInformation.qwMemorySize"), d = g.GetValue("DriverDesc");
                                long v = m is long ? (long)m : m is byte[] && ((byte[])m).Length >= 8 ? BitConverter.ToInt64((byte[])m, 0) : 0;
                                if (d != null && v > vram) { vram = v; nome = d.ToString(); }
                            }
            }
            catch { }
        });
        if (nome == null) { TextoPerfil(); return; }
        double gb = vram / (1024.0 * 1024 * 1024);
        string n = nome.ToUpperInvariant();
        bool dedicada = n.Contains("GEFORCE") || n.Contains("RTX") || n.Contains("GTX") || n.Contains("RADEON RX") || n.Contains("ARC ");
        bool forte = n.Contains("RTX") || System.Text.RegularExpressions.Regex.IsMatch(n, @"RX\s?[6-9]\d{3}") || n.Contains("ARC B") || n.Contains("ARC A7");
        recomendado = dedicada && forte && gb >= 6 ? "Ultra" : dedicada && gb >= 3 ? "Equilibrado" : "Leve";
        placaTexto = nome + " (" + Num(Math.Round(gb), "0") + " GB)";
        foreach (var p in perfis) F<Border>("rec" + p.Nome).Visibility = p.Nome == recomendado ? Visibility.Visible : Visibility.Collapsed;
        TextoPerfil();
    }

    // ---------- interface no estilo Apple: rolagem suave, grupos com separadores, busca, janela responsiva
    // rolagem com inércia: a roda do mouse define um alvo e o conteúdo desliza até ele
    class Rolagem
    {
        public ScrollViewer Sv; public bool Horiz; public double Alvo = -1; bool rodando;
        double Atual { get { return Horiz ? Sv.HorizontalOffset : Sv.VerticalOffset; } }
        double Max { get { return Horiz ? Sv.ScrollableWidth : Sv.ScrollableHeight; } }
        public void Para(double alvo)
        {
            if (Alvo < 0 || !rodando) Alvo = Atual;
            Alvo = Math.Max(0, Math.Min(Max, alvo));
            if (!rodando) { rodando = true; CompositionTarget.Rendering += Passo; }
        }
        public void Somar(double d) { Para((rodando ? Alvo : Atual) + d); }
        void Passo(object s, EventArgs e)
        {
            double c = Atual, n = c + (Alvo - c) * 0.18;
            if (Math.Abs(Alvo - c) < 0.6) { n = Alvo; rodando = false; CompositionTarget.Rendering -= Passo; }
            if (Horiz) Sv.ScrollToHorizontalOffset(n); else Sv.ScrollToVerticalOffset(n);
        }
    }
    readonly List<Rolagem> rolagens = new List<Rolagem>();
    Rolagem Suave(ScrollViewer sv, bool horiz)
    {
        var r = new Rolagem { Sv = sv, Horiz = horiz };
        sv.PreviewMouseWheel += (s, e) =>
        {
            // a fileira horizontal cuida da própria roda quando o mouse está nela
            if (!horiz && rolagens.Any(o => o.Horiz && o.Sv.IsMouseOver && o.Sv.ScrollableWidth > 0)) return;
            r.Somar(-e.Delta * (horiz ? 1.4 : 1.1)); e.Handled = true;
        };
        rolagens.Add(r);
        return r;
    }

    static IEnumerable<DependencyObject> Arvore(DependencyObject raiz)
    {
        var fila = new Queue<DependencyObject>(); fila.Enqueue(raiz);
        while (fila.Count > 0)
        {
            var d = fila.Dequeue(); yield return d;
            foreach (var f in LogicalTreeHelper.GetChildren(d).OfType<DependencyObject>()) fila.Enqueue(f);
        }
    }

    class ItemBusca { public string Texto, Pagina, Chave; public FrameworkElement Alvo; }
    readonly List<ItemBusca> indice = new List<ItemBusca>();
    static string SemAcento(string t)
    {
        var n = t.Normalize(NormalizationForm.FormD); var sb = new StringBuilder();
        foreach (var ch in n) if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) sb.Append(ch);
        return sb.ToString().ToLowerInvariant();
    }

    string[] paginas; readonly Dictionary<string, string> nomesPagina = new Dictionary<string, string>
    { { "Home", "Início" }, { "Video", "Gráficos" }, { "Perf", "FPS e Hz" }, { "Ctrl", "Controles" }, { "Online", "Online" }, { "Hunt", "Caçada" }, { "Mods", "Mods e Cheats" }, { "About", "Sobre" } };

    void Visual(string[] navs)
    {
        paginas = navs;
        CantosNativos();
        Win.Loaded += async (s, e) => { await Task.Delay(8000); Enxugar(); };
        var linha = (Brush)Win.FindResource("Line");
        var estCard = (Style)Win.FindResource("Card"); var estRow = (Style)Win.FindResource("Row");
        var estLbl = (Style)Win.FindResource("Lbl"); var estTit = (Style)Win.FindResource("CardTitle"); var estH1 = (Style)Win.FindResource("H1");
        F<System.Windows.Shapes.Rectangle>("grain").Fill = Grao();
        foreach (var n in navs)
        {
            var pg = F<ScrollViewer>("pg" + n);
            Suave(pg, false);
            foreach (var d in Arvore(pg).ToList())
            {
                // separador fino entre as linhas de um grupo, como nos Ajustes do Mac
                var b = d as Border;
                if (b != null && b.Style == estCard && b.Child is StackPanel)
                {
                    var sp = (StackPanel)b.Child; bool antes = false;
                    for (int i = 0; i < sp.Children.Count; i++)
                    {
                        var g = sp.Children[i] as Grid;
                        bool row = g != null && g.Style == estRow;
                        if (row && antes) { sp.Children.Insert(i, new System.Windows.Shapes.Rectangle { Height = 1, Fill = linha, Margin = new Thickness(0, 0, -18, 0), SnapsToDevicePixels = true }); i++; }
                        antes = row;
                    }
                    Ornamentar(b);
                }
                // divisória de guilda (losango e traço) embaixo do título da página
                var h1 = d as TextBlock;
                if (h1 != null && h1.Style == estH1 && h1.Parent is StackPanel)
                {
                    var pai = (StackPanel)h1.Parent;
                    pai.Children.Insert(pai.Children.IndexOf(h1) + 1, Divisoria());
                }
                // índice da busca: os nomes de cada ajuste e de cada grupo
                var t = d as TextBlock;
                if (t != null && (t.Style == estLbl || t.Style == estTit) && !string.IsNullOrWhiteSpace(t.Text) && t.Text.Length > 2)
                {
                    FrameworkElement alvo = t.Style == estTit ? (FrameworkElement)(t.Parent as FrameworkElement ?? t) : t;
                    while (alvo.Parent is FrameworkElement && !(alvo is Grid && ((Grid)alvo).Style == estRow) && !(alvo is Border && ((Border)alvo).Style == estCard)) alvo = (FrameworkElement)alvo.Parent;
                    indice.Add(new ItemBusca { Texto = t.Text, Pagina = n, Chave = SemAcento(t.Text), Alvo = alvo });
                }
            }
        }
        foreach (var n in navs) indice.Add(new ItemBusca { Texto = nomesPagina[n], Pagina = n, Chave = SemAcento(nomesPagina[n]), Alvo = null });
        Suave(F<ScrollViewer>("navScroll"), false);

        // busca
        var txt = F<TextBox>("txtSearch"); var pop = F<System.Windows.Controls.Primitives.Popup>("searchPop");
        txt.TextChanged += (s, e) => { F<TextBlock>("searchHint").Visibility = txt.Text.Length > 0 ? Visibility.Collapsed : Visibility.Visible; Buscar(txt.Text); };
        txt.PreviewKeyDown += (s, e) =>
        {
            if (e.Key == Key.Escape) { txt.Text = ""; pop.IsOpen = false; Keyboard.ClearFocus(); }
            if (e.Key == Key.Enter && resultados.Count > 0) IrPara(resultados[0]);
        };

        // janela: arrastar, maximizar com duplo clique, botões
        F<Border>("titleBar").MouseLeftButtonDown += (s, e) =>
        {
            if (e.ClickCount == 2) { Maximizar(); return; }
            if (Win.WindowState == WindowState.Maximized) return;
            Win.DragMove();
        };
        F<Button>("btnMax").Click += (s, e) => Maximizar();
        Win.StateChanged += (s, e) =>
        {
            bool max = Win.WindowState == WindowState.Maximized;
            // maximizada, a janela sem moldura passa um pouco da tela: compensa a borda
            F<Border>("root").Margin = new Thickness(max ? 7 : 0);
            VideoVisivel();
            F<Button>("btnMax").Content = max ? "" : "";
        };
        Win.SizeChanged += (s, e) => Responsivo();

        // abertura: aparece crescendo um pouco, como os apps do Mac
        if (!semAnimacao) Win.Loaded += (s, e) =>
        {
            MostrarPagina(F<FrameworkElement>("pgHome"));
            Animar(F<ScaleTransform>("rootScale"), ScaleTransform.ScaleXProperty, 1, 420, 0.965);
            Animar(F<ScaleTransform>("rootScale"), ScaleTransform.ScaleYProperty, 1, 420, 0.965);
        };

        // mini-player e setas da fileira
        F<Button>("miniPrev").Click += (s, e) => { if (cenasLigadas) TocarCena((cenaAtual + cenas.Count - 1) % cenas.Count); };
        F<Button>("miniNext").Click += (s, e) => { if (cenasLigadas) TocarCena((cenaAtual + 1) % cenas.Count); };
        F<Button>("miniPlay").Click += (s, e) => PausarCena(!cenaPausada);
        var prat = Suave(F<ScrollViewer>("scenesScroll"), true);
        F<Button>("shelfLeft").Click += (s, e) => prat.Somar(-prat.Sv.ViewportWidth * 0.8);
        F<Button>("shelfRight").Click += (s, e) => prat.Somar(prat.Sv.ViewportWidth * 0.8);
        var shelf = F<Grid>("shelf");
        shelf.MouseEnter += (s, e) => { Animar(F<Button>("shelfLeft"), UIElement.OpacityProperty, 1, 180); Animar(F<Button>("shelfRight"), UIElement.OpacityProperty, 1, 180); };
        shelf.MouseLeave += (s, e) => { Animar(F<Button>("shelfLeft"), UIElement.OpacityProperty, 0, 220); Animar(F<Button>("shelfRight"), UIElement.OpacityProperty, 0, 220); };
    }

    [DllImport("kernel32.dll")] static extern bool SetProcessWorkingSetSize(IntPtr proc, IntPtr min, IntPtr max);
    // devolve ao Windows a memória que sobrou da abertura (e, com o jogo aberto, deixa a RAM para ele)
    static void Enxugar()
    {
        GC.Collect(); GC.WaitForPendingFinalizers(); GC.Collect();
        try { SetProcessWorkingSetSize(Process.GetCurrentProcess().Handle, (IntPtr)(-1), (IntPtr)(-1)); } catch { }
    }

    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
    void CantosNativos()
    {
        Win.SourceInitialized += (s, e) =>
        {
            var h = new System.Windows.Interop.WindowInteropHelper(Win).Handle;
            int arredondado = 2;  // DWMWA_WINDOW_CORNER_PREFERENCE = DWMWCP_ROUND (Windows 11; no 10 não faz nada)
            DwmSetWindowAttribute(h, 33, ref arredondado, 4);
            int escuro = 1;       // barra/borda escura do sistema
            DwmSetWindowAttribute(h, 20, ref escuro, 4);
        };
    }

    // textura de couro: ruído quente bem leve, em ladrilho (uma imagem pequena, desenhada uma vez)
    static ImageBrush Grao()
    {
        const int N = 160; var px = new byte[N * N * 4]; var r = new Random(7);
        for (int k = 0; k < N * N; k++)
        {
            int a = r.Next(0, 26), v = r.Next(90, 255);
            px[k * 4 + 0] = (byte)(v * 0.62 * a / 255); px[k * 4 + 1] = (byte)(v * 0.78 * a / 255); px[k * 4 + 2] = (byte)(v * 0.92 * a / 255); px[k * 4 + 3] = (byte)a;
        }
        var bmp = BitmapSource.Create(N, N, 96, 96, PixelFormats.Pbgra32, null, px, N * 4); bmp.Freeze();
        return new ImageBrush(bmp) { TileMode = TileMode.Tile, Viewport = new Rect(0, 0, N, N), ViewportUnits = BrushMappingMode.Absolute, Stretch = Stretch.None };
    }

    // cantoneiras nos quatro cantos dos painéis, como as molduras dos menus do jogo
    static readonly Geometry CANTO = Geometry.Parse("M0.5,12 V2.5 Q0.5,0.5 2.5,0.5 H12 M4,4 L5.5,4 L5.5,5.5 L4,5.5 Z");
    void Ornamentar(Border b)
    {
        var conteudo = b.Child; b.Child = null;
        var g = new Grid(); g.Children.Add(conteudo);
        var pad = b.Padding;
        var camada = new Grid { Margin = new Thickness(-pad.Left + 4, -pad.Top + 4, -pad.Right + 4, -pad.Bottom + 4), IsHitTestVisible = false };
        var cor = new SolidColorBrush(Color.FromRgb(0x8A, 0x6E, 0x52)); cor.Freeze();
        foreach (var canto in new[] { new[] { 0, 0 }, new[] { 1, 0 }, new[] { 0, 1 }, new[] { 1, 1 } })
            camada.Children.Add(new System.Windows.Shapes.Path
            {
                Data = CANTO, Stroke = cor, StrokeThickness = 1.3, Width = 13, Height = 13,
                HorizontalAlignment = canto[0] == 0 ? HorizontalAlignment.Left : HorizontalAlignment.Right,
                VerticalAlignment = canto[1] == 0 ? VerticalAlignment.Top : VerticalAlignment.Bottom,
                RenderTransformOrigin = new Point(0.5, 0.5), RenderTransform = new ScaleTransform(canto[0] == 0 ? 1 : -1, canto[1] == 0 ? 1 : -1)
            });
        g.Children.Add(camada);
        b.Child = g;
    }

    FrameworkElement Divisoria()
    {
        var sp = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(3, 6, 0, 2), IsHitTestVisible = false };
        sp.Children.Add(new System.Windows.Shapes.Rectangle { Width = 8, Height = 8, Fill = (Brush)Win.FindResource("Ember"), RenderTransformOrigin = new Point(0.5, 0.5), RenderTransform = new RotateTransform(45), VerticalAlignment = VerticalAlignment.Center });
        sp.Children.Add(new System.Windows.Shapes.Rectangle { Width = 46, Height = 2, Fill = (Brush)Win.FindResource("Ember"), VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(6, 0, 0, 0) });
        sp.Children.Add(new System.Windows.Shapes.Rectangle { Width = 160, Height = 1, VerticalAlignment = VerticalAlignment.Center, Fill = new LinearGradientBrush(Color.FromRgb(0x6E, 0x5A, 0x47), Color.FromArgb(0, 0x6E, 0x5A, 0x47), 0) });
        return sp;
    }

    void Maximizar()
    {
        if (Win.WindowState == WindowState.Maximized) { Win.WindowState = WindowState.Normal; return; }
        // sem cobrir a barra de tarefas
        Win.WindowState = WindowState.Maximized;
    }

    // reorganiza conforme o tamanho: menu só com ícones, colunas, altura do destaque
    bool compacto;
    void Responsivo()
    {
        double w = Win.ActualWidth;
        bool c = w < 1000;
        if (c != compacto)
        {
            compacto = c;
            F<ColumnDefinition>("colSide").Width = new GridLength(c ? 78 : 250);
            foreach (var nome in new[] { "brandText", "searchBox", "txtCredit", "capPlay", "capSet", "capMore" })
                F<FrameworkElement>(nome).Visibility = c ? Visibility.Collapsed : Visibility.Visible;
            foreach (var n in paginas)
            {
                var rb = F<RadioButton>("nav" + n);
                if (c) { rb.ToolTip = nomesPagina[n]; rb.Content = ""; } else { rb.Content = nomesPagina[n]; rb.ToolTip = null; }
            }
            F<Button>("btnPlay").Content = c ? "" : "Partir em missão";
        }
        double conteudo = w - (c ? 78 : 250) - 28 - 60;
        F<UniformGrid>("statsGrid").Columns = conteudo > 700 ? 4 : 2;
        F<UniformGrid>("huntersPanel").Columns = conteudo > 820 ? 3 : conteudo > 520 ? 2 : 1;
        F<UniformGrid>("modeGrid").Columns = conteudo > 560 ? 2 : 1;
        F<UniformGrid>("perfilGrid").Columns = conteudo > 620 ? 3 : 1;
        F<Border>("hero").Height = Math.Max(240, Math.Min(420, conteudo * 0.38));
        F<Border>("miniPlayer").Width = Math.Max(260, Math.Min(460, conteudo * 0.5));
    }

    List<ItemBusca> resultados = new List<ItemBusca>();
    void Buscar(string q)
    {
        var pop = F<System.Windows.Controls.Primitives.Popup>("searchPop"); var lista = F<StackPanel>("searchList");
        lista.Children.Clear();
        string k = SemAcento(q.Trim());
        if (k.Length < 2) { pop.IsOpen = false; return; }
        resultados = indice.Where(i => i.Chave.Contains(k)).OrderBy(i => i.Chave.StartsWith(k) ? 0 : 1).ThenBy(i => i.Alvo == null ? 0 : 1)
                           .GroupBy(i => i.Texto + i.Pagina).Select(g => g.First()).Take(9).ToList();
        if (resultados.Count == 0) lista.Children.Add(new TextBlock { Text = "Nada encontrado", Foreground = (Brush)Win.FindResource("Sub"), Margin = new Thickness(10, 8, 10, 8) });
        foreach (var r in resultados)
        {
            var item = r;
            var b = new Button { Style = (Style)Win.FindResource("Btn"), Background = Brushes.Transparent, HorizontalContentAlignment = HorizontalAlignment.Left, Padding = new Thickness(10, 7, 10, 7), Margin = new Thickness(0, 1, 0, 1) };
            var sp = new StackPanel();
            sp.Children.Add(new TextBlock { Text = r.Texto, FontSize = 13, TextTrimming = TextTrimming.CharacterEllipsis });
            sp.Children.Add(new TextBlock { Text = r.Alvo == null ? "Página" : nomesPagina[r.Pagina], FontSize = 11, Foreground = (Brush)Win.FindResource("Sub") });
            b.Content = sp; b.HorizontalAlignment = HorizontalAlignment.Stretch;
            b.Click += (s, e) => IrPara(item);
            lista.Children.Add(b);
        }
        pop.IsOpen = true;
    }

    void IrPara(ItemBusca r)
    {
        F<System.Windows.Controls.Primitives.Popup>("searchPop").IsOpen = false;
        F<TextBox>("txtSearch").Text = ""; Keyboard.ClearFocus();
        F<RadioButton>("nav" + r.Pagina).IsChecked = true;
        if (r.Alvo == null) return;
        Win.Dispatcher.BeginInvoke(new Action(() =>
        {
            var pg = F<ScrollViewer>("pg" + r.Pagina);
            var pos = r.Alvo.TransformToAncestor(pg).Transform(new Point(0, 0));
            var rol = rolagens.First(o => o.Sv == pg);
            rol.Para(pg.VerticalOffset + pos.Y - 90);
            // destaque piscando no ajuste encontrado
            var realce = new SolidColorBrush(Color.FromArgb(0x33, 0xFF, 0xFF, 0xFF));
            var g = r.Alvo as Panel; var bo = r.Alvo as Border;
            Brush antigo = g != null ? g.Background : bo != null ? bo.Background : null;
            if (g != null) g.Background = realce; else if (bo != null) bo.Background = realce;
            var a = new System.Windows.Media.Animation.ColorAnimation(Color.FromArgb(0, 0xFF, 0xFF, 0xFF), TimeSpan.FromMilliseconds(1600)) { BeginTime = TimeSpan.FromMilliseconds(500) };
            a.Completed += (s, e) => { if (g != null) g.Background = antigo; else if (bo != null) bo.Background = antigo; };
            realce.BeginAnimation(SolidColorBrush.ColorProperty, a);
        }), DispatcherPriority.Loaded);
    }

    // ---------- cenas do jogo: os vídeos da cópia do jogador (data\romfs\nativeNX\movie) no Início e no fundo
    class Cena { public string Nome; public int Video; public double Ini, Fim; public Border Cartao; public BitmapSource Foto, Borrada; }
    readonly List<Cena> cenas = new List<Cena>
    {
        new Cena { Nome = "Glavenus",        Video = 2, Ini = 2,   Fim = 58 },
        new Cena { Nome = "Mizutsune",       Video = 4, Ini = 2,   Fim = 44 },
        new Cena { Nome = "Gammoth",         Video = 5, Ini = 2,   Fim = 49 },
        new Cena { Nome = "Selva dourada",   Video = 3, Ini = 2,   Fim = 43 },
        new Cena { Nome = "Tempestade",      Video = 6, Ini = 20,  Fim = 110 },
        new Cena { Nome = "Olhar do dragão", Video = 7, Ini = 2,   Fim = 45 },
        new Cena { Nome = "Abertura",        Video = 0, Ini = 30,  Fim = 200 },
        new Cena { Nome = "Felynes",         Video = 1, Ini = 4,   Fim = 100 },
        new Cena { Nome = "Festa no Hub",    Video = 8, Ini = 10,  Fim = 120 },
        new Cena { Nome = "Nova aventura",   Video = 9, Ini = 120, Fim = 205 },
    };
    const double CENA_SEG = 16;  // quanto tempo cada cena fica no fundo antes da próxima
    int cenaAtual = -1; double cenaFim; DispatcherTimer cenaTimer; bool cenasLigadas, trocando, cenaPausada;
    readonly Random rnd = new Random();

    string VideoArq(int n) { return Path.Combine(Dir, "data", "romfs", "nativeNX", "movie", "movie" + n.ToString("00") + ".mp4"); }

    void Cenas()
    {
        var tg = F<CheckBox>("tgVideoBg");
        bool temVideos = cenas.All(c => File.Exists(VideoArq(c.Video)));
        tg.IsChecked = temVideos && Config("cenas", "1") == "1";
        if (!temVideos) { tg.IsEnabled = false; F<TextBlock>("hintVideo").Text = "Precisa dos vídeos do jogo em data\\romfs\\nativeNX\\movie."; }
        RoutedEventHandler h = (s, e) => { SetConfig("cenas", tg.IsChecked == true ? "1" : "0"); if (tg.IsChecked == true) LigarCenas(); else DesligarCenas(); };
        tg.Checked += h; tg.Unchecked += h;

        // o vídeo do destaque com os cantos do cartão
        var hv = F<Grid>("heroVideo");
        hv.SizeChanged += (s, e) => hv.Clip = new RectangleGeometry(new Rect(0, 0, hv.ActualWidth, hv.ActualHeight), 17, 17);

        var vid = F<MediaElement>("vid");
        vid.MediaOpened += (s, e) =>
        {
            vid.Position = TimeSpan.FromSeconds(cenaFim - CENA_SEG);
            vid.Play();
            Animar(F<System.Windows.Shapes.Rectangle>("vidFade"), UIElement.OpacityProperty, 0, 500);
            trocando = false;
        };
        vid.MediaFailed += (s, e) => { trocando = false; DesligarCenas(); F<TextBlock>("hintVideo").Text = "Não deu para tocar os vídeos neste PC: " + e.ErrorException.Message; };

        cenaTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(250) };
        cenaTimer.Tick += (s, e) =>
        {
            if (cenaPausada) return;
            double p = vid.Position.TotalSeconds;
            if (!trocando && p >= cenaFim) { TocarCena((cenaAtual + 1) % cenas.Count); return; }
            // barra de progresso do mini-player
            var trilho = (FrameworkElement)F<Border>("miniProg").Parent;
            F<Border>("miniProg").Width = Math.Max(0, Math.Min(1, (p - (cenaFim - CENA_SEG)) / CENA_SEG)) * trilho.ActualWidth;
        };

        // só depois da janela aberta (as continuações async precisam voltar para a thread da interface)
        Win.Loaded += (s, e) =>
        {
            if (temVideos) MontarCartoes();
            if (tg.IsChecked == true) LigarCenas();
        };
    }

    void LigarCenas()
    {
        cenasLigadas = true;
        Animar(F<Grid>("heroVideo"), UIElement.OpacityProperty, 1, 600);
        F<Grid>("heroArt").Visibility = Visibility.Collapsed;
        F<Border>("scenePill").Visibility = Visibility.Visible;
        F<Border>("scenesCard").Visibility = Visibility.Visible;
        F<Border>("miniPlayer").Visibility = Visibility.Visible;
        TocarCena(cenaAtual >= 0 ? cenaAtual : rnd.Next(6));  // começa por um dos monstros
        cenaTimer.Start();
    }

    bool fundoB;
    void Fundo(Cena c)
    {
        if (c.Foto == null) return;
        if (c.Borrada == null) c.Borrada = Borrar(c.Foto);
        var entra = F<Image>(fundoB ? "bgB" : "bgA"); var sai = F<Image>(fundoB ? "bgA" : "bgB");
        fundoB = !fundoB;
        entra.Source = c.Borrada;
        Animar(entra, UIElement.OpacityProperty, 1, 700);
        Animar(sai, UIElement.OpacityProperty, 0, 700);
    }

    // desfoque calculado uma vez numa imagem pequena (barato), em vez de desfocar o vídeo a cada quadro
    static BitmapSource Borrar(BitmapSource foto)
    {
        const int W = 192, H = 108, M = 24;
        var img = new Image { Source = foto, Width = W + 2 * M, Height = H + 2 * M, Stretch = Stretch.UniformToFill, Effect = new System.Windows.Media.Effects.BlurEffect { Radius = 18 } };
        img.Measure(new Size(W + 2 * M, H + 2 * M)); img.Arrange(new Rect(-M, -M, W + 2 * M, H + 2 * M));
        var rtb = new RenderTargetBitmap(W, H, 96, 96, PixelFormats.Pbgra32);
        rtb.Render(img); rtb.Freeze();
        return rtb;
    }

    void PausarCena(bool pausar)
    {
        if (!cenasLigadas) return;
        cenaPausada = pausar;
        var vid = F<MediaElement>("vid");
        if (pausar) vid.Pause(); else vid.Play();
        F<Button>("miniPlay").Content = pausar ? "" : "";
    }

    // pausa o vídeo fora do Início ou com a janela minimizada (não gasta CPU/GPU à toa)
    void VideoVisivel()
    {
        if (!cenasLigadas) return;
        bool ver = F<FrameworkElement>("pgHome").Visibility == Visibility.Visible && Win.WindowState != WindowState.Minimized;
        F<Border>("miniPlayer").Visibility = ver ? Visibility.Visible : Visibility.Collapsed;
        var vid = F<MediaElement>("vid");
        if (ver && !cenaPausada) { vid.Play(); cenaTimer.Start(); }
        else { vid.Pause(); cenaTimer.Stop(); }
    }

    void DesligarCenas()
    {
        cenasLigadas = false; cenaTimer.Stop();
        F<MediaElement>("vid").Stop(); F<MediaElement>("vid").Source = null;
        foreach (var nome in new[] { "bgA", "bgB" }) { F<Image>(nome).BeginAnimation(UIElement.OpacityProperty, null); F<Image>(nome).Opacity = 0; }
        F<Grid>("heroVideo").BeginAnimation(UIElement.OpacityProperty, null); F<Grid>("heroVideo").Opacity = 0;
        F<Grid>("heroArt").Visibility = Visibility.Visible;
        F<Border>("scenePill").Visibility = Visibility.Collapsed;
        F<Border>("scenesCard").Visibility = Visibility.Collapsed;
        F<Border>("miniPlayer").Visibility = Visibility.Collapsed;
        F<StackPanel>("sceneDots").Children.Clear();
    }

    async void TocarCena(int i)
    {
        if (!cenasLigadas || trocando) return;
        trocando = true;
        var c = cenas[i]; cenaAtual = i;
        // um trecho diferente da cena a cada vez
        double ini = c.Ini + rnd.NextDouble() * Math.Max(0, c.Fim - c.Ini - CENA_SEG);
        cenaFim = ini + CENA_SEG;
        var fade = F<System.Windows.Shapes.Rectangle>("vidFade");
        Animar(fade, UIElement.OpacityProperty, 1, 350);
        await Task.Delay(360);
        if (!cenasLigadas) { trocando = false; return; }
        F<TextBlock>("txtScene").Text = "Em cena  ·  " + c.Nome;
        F<TextBlock>("miniTitle").Text = c.Nome;
        F<TextBlock>("txtStars").Text = new string('★', 4 + (i * 7) % 3);
        F<ImageBrush>("miniThumb").ImageSource = c.Foto;
        Fundo(c);
        if (cenaPausada) PausarCena(false);
        var vid = F<MediaElement>("vid");
        var uri = new Uri(VideoArq(c.Video));
        if (vid.Source != null && vid.Source == uri)
        {
            vid.Position = TimeSpan.FromSeconds(ini); vid.Play();
            Animar(fade, UIElement.OpacityProperty, 0, 500);
            trocando = false;
        }
        else { vid.Source = uri; vid.Play(); }  // posição e fade no MediaOpened
        // pontinhos e cartão em destaque
        var dots = F<StackPanel>("sceneDots"); dots.Children.Clear();
        for (int k = 0; k < cenas.Count; k++)
            dots.Children.Add(new Border { Width = k == i ? 18 : 6, Height = 6, CornerRadius = new CornerRadius(3), Margin = new Thickness(3, 0, 0, 0), Background = k == i ? (Brush)Win.FindResource("GoldHi") : new SolidColorBrush(Color.FromArgb(0x66, 0xFF, 0xFF, 0xFF)) });
        foreach (var o in cenas) if (o.Cartao != null) o.Cartao.BorderBrush = o == c ? (Brush)Win.FindResource("Ember") : Brushes.Transparent;
    }

    // cartões com foto de cada cena; as fotos saem dos vídeos e ficam em cache (%LOCALAPPDATA%\MHGU Launcher\cenas)
    async void MontarCartoes()
    {
        var lista = F<StackPanel>("scenesList"); lista.Children.Clear();
        var rolar = F<ScrollViewer>("scenesScroll");
        rolar.PreviewMouseWheel += (s, e) => { rolar.ScrollToHorizontalOffset(rolar.HorizontalOffset - e.Delta); e.Handled = true; };
        string cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MHGU Launcher", "cenas");
        Directory.CreateDirectory(cache);
        for (int i = 0; i < cenas.Count; i++)
        {
            var c = cenas[i]; int idx = i;
            var img = new ImageBrush { Stretch = Stretch.UniformToFill };
            var sombra = new System.Windows.Media.Effects.DropShadowEffect { BlurRadius = 10, ShadowDepth = 5, Opacity = 0.55, Direction = 280 };
            var papel = new LinearGradientBrush(Color.FromRgb(0xEF, 0xE4, 0xCD), Color.FromRgb(0xDC, 0xCB, 0xAA), 90);
            var foto = new Border { Width = 214, Height = 120, CornerRadius = new CornerRadius(1), Background = img, BorderThickness = new Thickness(1), BorderBrush = new SolidColorBrush(Color.FromArgb(0x55, 0x2A, 0x1F, 0x16)) };
            double angulo = new[] { -2.4, 1.6, -1.1, 2.2, -1.8, 1.2, -2.0, 1.8, -1.4, 2.4 }[i % 10];
            var giro = new RotateTransform(angulo); var zoom = new ScaleTransform(1, 1);
            var tg = new TransformGroup(); tg.Children.Add(zoom); tg.Children.Add(giro);
            var card = new Border { Margin = new Thickness(6, 18, 20, 10), Cursor = Cursors.Hand, Background = papel, Padding = new Thickness(7, 7, 7, 9), CornerRadius = new CornerRadius(2), BorderThickness = new Thickness(2), BorderBrush = Brushes.Transparent, Effect = sombra, RenderTransformOrigin = new Point(0.5, 0.1), RenderTransform = tg };
            var g = new Grid();
            var sp = new StackPanel();
            sp.Children.Add(foto);
            sp.Children.Add(new TextBlock { Text = c.Nome, FontFamily = (FontFamily)Win.FindResource("Display"), FontSize = 14.5, FontWeight = FontWeights.Black, Foreground = (Brush)Win.FindResource("Ink"), Margin = new Thickness(2, 7, 2, 0) });
            var linha = new TextBlock { FontSize = 12.5, Margin = new Thickness(2, 1, 2, 0), Foreground = new SolidColorBrush(Color.FromRgb(0x6B, 0x55, 0x40)) };
            linha.Inlines.Add(new System.Windows.Documents.Run(new string('★', 4 + (i * 7) % 3)) { Foreground = new SolidColorBrush(Color.FromRgb(0xB5, 0x38, 0x1F)) });
            linha.Inlines.Add(new System.Windows.Documents.Run("   Cena " + (i + 1)));
            sp.Children.Add(linha);
            g.Children.Add(sp);
            // tachinha
            var pino = new System.Windows.Shapes.Ellipse { Width = 15, Height = 15, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Top, Margin = new Thickness(0, -16, 0, 0), Stroke = new SolidColorBrush(Color.FromRgb(0x6E, 0x1E, 0x10)), StrokeThickness = 1,
                Fill = new RadialGradientBrush(Color.FromRgb(0xFF, 0x9A, 0x7A), Color.FromRgb(0xB5, 0x38, 0x1F)) { GradientOrigin = new Point(0.35, 0.3) } };
            g.Children.Add(pino);
            card.Child = g;
            card.MouseEnter += (s, e) => { Animar(giro, RotateTransform.AngleProperty, 0, 220); Animar(zoom, ScaleTransform.ScaleXProperty, 1.05, 220); Animar(zoom, ScaleTransform.ScaleYProperty, 1.05, 220); Animar(sombra, System.Windows.Media.Effects.DropShadowEffect.BlurRadiusProperty, 22, 220); };
            card.MouseLeave += (s, e) => { Animar(giro, RotateTransform.AngleProperty, angulo, 300); Animar(zoom, ScaleTransform.ScaleXProperty, 1, 300); Animar(zoom, ScaleTransform.ScaleYProperty, 1, 300); Animar(sombra, System.Windows.Media.Effects.DropShadowEffect.BlurRadiusProperty, 10, 300); };
            card.PreviewMouseLeftButtonDown += (s, e) => { Animar(zoom, ScaleTransform.ScaleXProperty, 0.97, 80); Animar(zoom, ScaleTransform.ScaleYProperty, 0.97, 80); };
            card.MouseLeftButtonUp += (s, e) => { Animar(zoom, ScaleTransform.ScaleXProperty, 1.05, 160); Animar(zoom, ScaleTransform.ScaleYProperty, 1.05, 160); if (cenasLigadas) TocarCena(idx); };
            c.Cartao = card;
            lista.Children.Add(card);

            double t = c.Ini + (c.Fim - c.Ini) * 0.4;
            string png = Path.Combine(cache, "movie" + c.Video.ToString("00") + "_" + ((int)t) + ".png");
            BitmapSource bmp = null;
            if (File.Exists(png)) { try { bmp = BitmapFrame.Create(new Uri(png), BitmapCreateOptions.None, BitmapCacheOption.OnLoad); } catch { } }
            if (bmp == null)
            {
                bmp = await Foto(VideoArq(c.Video), t);
                if (bmp != null) { try { var enc = new PngBitmapEncoder(); enc.Frames.Add(BitmapFrame.Create(bmp)); using (var fs = File.Create(png)) enc.Save(fs); } catch { } }
            }
            if (bmp != null) { img.ImageSource = bmp; c.Foto = bmp; if (idx == cenaAtual) { F<ImageBrush>("miniThumb").ImageSource = bmp; Fundo(c); } }
        }
    }

    // um quadro do vídeo no tempo t (MediaPlayer desenhado num bitmap)
    static async Task<BitmapSource> Foto(string arq, double t)
    {
        var mp = new MediaPlayer { IsMuted = true, ScrubbingEnabled = true };
        try
        {
            var aberto = new TaskCompletionSource<bool>();
            mp.MediaOpened += (s, e) => aberto.TrySetResult(true);
            mp.MediaFailed += (s, e) => aberto.TrySetResult(false);
            mp.Open(new Uri(arq));
            if (await Task.WhenAny(aberto.Task, Task.Delay(8000)) != aberto.Task || !aberto.Task.Result) return null;
            mp.Play(); mp.Pause();
            mp.Position = TimeSpan.FromSeconds(t);
            await Task.Delay(900);
            var dv = new DrawingVisual();
            using (var dc = dv.RenderOpen()) dc.DrawVideo(mp, new Rect(0, 0, 384, 216));
            var rtb = new RenderTargetBitmap(384, 216, 96, 96, PixelFormats.Pbgra32);
            rtb.Render(dv);
            // quadro todo preto (ainda não decodificou): não serve
            var px = new byte[384 * 216 * 4]; rtb.CopyPixels(px, 384 * 4, 0);
            long soma = 0; for (int k = 0; k < px.Length; k += 4 * 97) soma += px[k] + px[k + 1] + px[k + 2];
            if (soma < 2000) return null;
            rtb.Freeze();
            return rtb;
        }
        catch { return null; }
        finally { mp.Close(); }
    }

    // ---------- diagnóstico do HUD: lê as linhas "diag" que os plugins gravam no log.txt
    void HudDiag()
    {
        F<Button>("btnHudRefresh").Click += (s, e) => { LerDiag(); Toast("Diagnóstico atualizado"); };
        Win.Loaded += (s, e) => LerDiag();  // (async: depois da janela aberta)
    }

    async void LerDiag()
    {
        var p = F<StackPanel>("hudDiag"); p.Children.Clear();
        string log = Path.Combine(Dir, "log.txt");
        if (!File.Exists(log)) { DiagLinha(p, "Sub", "Ainda não há log: abra o jogo e faça uma caçada."); return; }
        bool hpCarregou = false, dmgCarregou = false, hpIncompat = false, dmgIncompat = false, desenhou = false, semAlvo = false;
        string vida = null, telaVida = null, imguiVida = null, dano = null, erro = null;
        DiagLinha(p, "Sub", "Lendo o log do jogo...");
        await Task.Run(() =>
        {
        try
        {
            // o jogo pode estar aberto escrevendo o log: abrir sem trancar
            using (var fs = new FileStream(log, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (var r = new StreamReader(fs, Encoding.UTF8))
            {
                string l;
                while ((l = r.ReadLine()) != null)
                {
                    if (!l.StartsWith("[forge]")) continue;
                    if (l.Contains("target-health-display v")) hpCarregou = true;
                    else if (l.Contains("attack-damage-display v")) dmgCarregou = true;
                    else if (l.Contains("mhgu-target-health-display: main+")) hpIncompat = true;
                    else if (l.Contains("mhgu-attack-damage-display: main+")) dmgIncompat = true;
                    else if (l.Contains("diag vida: tela informada")) telaVida = l.Substring(l.IndexOf("diag vida:") + 11);
                    else if (l.Contains("diag vida: ImGui")) imguiVida = l.Substring(l.IndexOf("diag vida:") + 11);
                    else if (l.Contains("diag vida:") && !l.Contains("slot do alvo"))
                    {
                        vida = l.Substring(l.IndexOf("diag vida:") + 11);
                        if (vida.Contains("desenhando")) desenhou = true;
                        if (vida.Contains("nenhum monstro")) semAlvo = true;
                    }
                    else if (l.Contains("diag dano:")) dano = l.Substring(l.IndexOf("diag dano:") + 11);
                }
            }
        }
        catch (Exception ex) { erro = ex.Message; }
        });
        p.Children.Clear();
        if (erro != null) { DiagLinha(p, "Bad", "Não consegui ler o log: " + erro); return; }

        // barra de vida
        if (AcharPlugin(NRO_HP) == null || AcharPlugin(NRO_HP).EndsWith(".off")) DiagLinha(p, "Sub", "Barra de vida: desligada.");
        else if (hpIncompat) DiagLinha(p, "Bad", "Barra de vida: o plugin não é compatível com esta versão do jogo (precisa da 1.4.0).");
        else if (!hpCarregou) DiagLinha(p, "Sub", "Barra de vida: não carregou na última vez que o jogo abriu (feche e abra o jogo).");
        else if (vida == null) DiagLinha(p, "Sub", "Barra de vida: carregou. Ainda sem dados de caçada — entre numa missão e depois clique em Atualizar.");
        else if (desenhou)
        {
            // "ImGui 1920x1080, barra desenhada ate (x, y)": fora da tela se passar do tamanho do ImGui
            var m = System.Text.RegularExpressions.Regex.Match(imguiVida ?? "", @"ImGui (\d+)x(\d+), barra desenhada ate \((-?\d+), (-?\d+)\)");
            bool fora = m.Success && (int.Parse(m.Groups[3].Value) > int.Parse(m.Groups[1].Value) || int.Parse(m.Groups[4].Value) > int.Parse(m.Groups[2].Value));
            if (fora) DiagLinha(p, "Bad", "Barra de vida: desenhada FORA da tela (o port informa um tamanho de tela diferente do real).");
            else DiagLinha(p, "Ok", "Barra de vida: funcionando (monstro marcado e barra desenhada).");
            DiagLinha(p, "Sub", "Detalhe técnico: " + string.Join("  ·  ", new[] { telaVida, imguiVida }.Where(x => x != null)));
        }
        else if (semAlvo) DiagLinha(p, "Gold", "Barra de vida: nenhum monstro foi marcado. Marque o monstro grande na câmera de alvo que a barra aparece.");
        else DiagLinha(p, "Gold", "Barra de vida: " + vida);

        // números de dano
        if (AcharPlugin(NRO_DMG) == null || AcharPlugin(NRO_DMG).EndsWith(".off")) DiagLinha(p, "Sub", "Números de dano: desligados.");
        else if (dmgIncompat) DiagLinha(p, "Bad", "Números de dano: o plugin não é compatível com esta versão do jogo (precisa da 1.4.0).");
        else if (!dmgCarregou) DiagLinha(p, "Sub", "Números de dano: não carregou na última vez que o jogo abriu.");
        else if (dano == null) DiagLinha(p, "Sub", "Números de dano: carregou. Ainda sem golpes registrados — bata num monstro e depois clique em Atualizar.");
        else
        {
            var n = System.Text.RegularExpressions.Regex.Matches(dano, @"(\d+)").Cast<System.Text.RegularExpressions.Match>().Select(m => long.Parse(m.Value)).ToArray();
            // ordem: colisões, acertos seus, dano chamado, números criados, na tela, fora da tela, visíveis, ...
            if (n.Length < 7) DiagLinha(p, "Gold", "Números de dano: " + dano);
            else if (n[0] == 0) DiagLinha(p, "Bad", "Números de dano: o port não passou pelos ganchos do plugin (os golpes não chegam até ele).");
            else if (n[1] == 0) DiagLinha(p, "Gold", "Números de dano: o jogo registrou golpes, mas nenhum foi reconhecido como seu.");
            else if (n[3] == 0) DiagLinha(p, "Gold", "Números de dano: seus golpes foram vistos (" + n[1] + "), mas o dano não foi ligado a eles.");
            else if (n[4] == 0) DiagLinha(p, "Bad", "Números de dano: " + n[3] + " números criados, mas todos ficaram fora da tela (problema de câmera do port).");
            else DiagLinha(p, "Ok", "Números de dano: funcionando (" + n[3] + " números, " + n[4] + " na tela).");
            DiagLinha(p, "Sub", "Detalhe técnico: " + dano);
        }
    }

    void DiagLinha(StackPanel p, string cor, string texto)
    {
        p.Children.Add(new TextBlock { Text = texto, FontSize = 13, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 3, 0, 3), Foreground = (Brush)Win.FindResource(cor == "Sub" ? "Sub" : cor) });
    }

    // ---------- resumo da página inicial
    void Resumo()
    {
        if (carregando) return;
        string res = ini.Get("Display", "Resolution", "Desktop"); if (res == "Desktop") res = Monitor();
        F<TextBlock>("stRes").Text = res;
        F<TextBlock>("stFps").Text = ini.Get("Performance", "FPS", "60") + " FPS" + (On(ini.Get("Performance", "VSync", "On")) ? " · VSync" : "");
        int mods = Directory.Exists(ModsOn) ? Directory.GetDirectories(ModsOn).Length : 0;
        F<TextBlock>("stMods").Text = mods + (mods == 1 ? " mod" : " mods");
        string j = ini.Get("Multiplayer", "Join", "");
        int on = statusAmigos.Count == 0 ? 0 : AmigosOnline();
        F<TextBlock>("stOnline").Text = on > 0 ? on + (on == 1 ? " amigo online" : " amigos online") : j.Length > 0 ? "Entrar" : "Hospedar";
        F<TextBlock>("stOnline").ToolTip = j.Length > 0 ? "Entrar no Hub de " + j : "Você cria o Hub (ou procura na rede local)";
        var hud = new List<string>();
        string a = AcharPlugin(NRO_HP), b = AcharPlugin(NRO_DMG);
        if (a != null && !a.EndsWith(".off")) hud.Add("barra de vida");
        if (b != null && !b.EndsWith(".off")) hud.Add("números de dano");
        F<TextBlock>("txtHeroInfo").Text = "HUD de caça: " + (hud.Count > 0 ? string.Join(" + ", hud) : "desligado");
    }

    void SalvarAgora()
    {
        try { if (ini != null) ini.Save(); }
        catch (Exception ex) { MessageBox.Show("Erro ao salvar: " + ex.Message, "MHGU Launcher"); }
    }

    void Jogar()
    {
        SalvarAgora();
        if (Process.GetProcessesByName("mhgurecomp").Length > 0) { MessageBox.Show("O jogo já está aberto. Feche ele para as mudanças valerem.", "MHGU Launcher"); return; }
        var jogo = Process.Start(new ProcessStartInfo(Path.Combine(Dir, "mhgurecomp.exe")) { WorkingDirectory = Dir, UseShellExecute = true });
        if (Config("teclas_tela", "1") != "1" || jogo == null) { Win.Close(); return; }
        // fica escondido com as teclas F11/Esc até o jogo fechar
        Win.Hide();
        if (cenasLigadas) { cenaTimer.Stop(); F<MediaElement>("vid").Stop(); }  // (não gastar vídeo com o jogo aberto)
        Enxugar();
        padTimer.Stop();
        jogoPid = jogo.Id;
        teclado = Teclado;
        using (var m = Process.GetCurrentProcess().MainModule) gancho = SetWindowsHookEx(13, teclado, GetModuleHandle(m.ModuleName), 0);
        var vigia = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        vigia.Tick += (s, e) =>
        {
            bool vivo; try { vivo = !Process.GetProcessById(jogoPid).HasExited; } catch { vivo = false; }
            if (!vivo) { vigia.Stop(); if (gancho != IntPtr.Zero) UnhookWindowsHookEx(gancho); Application.Current.Shutdown(); }
        };
        vigia.Start();
    }

    // ---------- F11 = tela cheia, Esc = janela (o port alterna com Alt+Enter; só mandamos Alt+Enter quando precisa)
    delegate IntPtr ProcTeclado(int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int idHook, ProcTeclado fn, IntPtr hMod, uint threadId);
    [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out int pid);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT r);
    [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
    [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr mon, ref MONITORINFO mi);
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT rcMonitor, rcWork; public uint dwFlags; }

    ProcTeclado teclado;   // guardado para o GC não recolher o delegate
    IntPtr gancho;
    int jogoPid;

    IntPtr JanelaDoJogo()
    {
        IntPtr h = GetForegroundWindow(); int pid;
        GetWindowThreadProcessId(h, out pid);
        return pid == jogoPid ? h : IntPtr.Zero;
    }
    static bool TelaCheia(IntPtr h)
    {
        RECT r; if (!GetWindowRect(h, out r)) return false;
        var mi = new MONITORINFO { cbSize = Marshal.SizeOf(typeof(MONITORINFO)) };
        if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
        return r.L <= mi.rcMonitor.L && r.T <= mi.rcMonitor.T && r.R >= mi.rcMonitor.R && r.B >= mi.rcMonitor.B;
    }
    IntPtr Teclado(int nCode, IntPtr wParam, IntPtr lParam)
    {
        int msg = wParam.ToInt32();
        if (nCode >= 0 && (msg == 0x100 || msg == 0x104))
        {
            int vk = Marshal.ReadInt32(lParam);
            IntPtr h = JanelaDoJogo();
            if (h != IntPtr.Zero && (vk == 0x7A || vk == 0x1B))
            {
                bool cheia = TelaCheia(h);
                if ((vk == 0x7A && !cheia) || (vk == 0x1B && cheia))
                    Win.Dispatcher.BeginInvoke(new Action(AltEnter));
                if (vk == 0x7A) return (IntPtr)1;   // F11 não vai para o jogo; Esc segue normal (solta o mouse)
            }
        }
        return CallNextHookEx(gancho, nCode, wParam, lParam);
    }
    static void AltEnter()
    {
        keybd_event(0x12, 0x38, 0, UIntPtr.Zero);       // Alt
        keybd_event(0x0D, 0x1C, 0, UIntPtr.Zero);       // Enter
        keybd_event(0x0D, 0x1C, 2, UIntPtr.Zero);
        keybd_event(0x12, 0x38, 2, UIntPtr.Zero);
    }

    // ---------- preferências do launcher (não vão para o mhgurecomp.ini)
    string ConfigArq { get { return Path.Combine(Dir, "launcher.ini"); } }
    string Config(string k, string def)
    {
        try { foreach (var l in File.ReadAllLines(ConfigArq)) { int i = l.IndexOf('='); if (i > 0 && l.Substring(0, i).Trim() == k) return l.Substring(i + 1).Trim(); } }
        catch { }
        return def;
    }
    void SetConfig(string k, string v)
    {
        var ls = File.Exists(ConfigArq) ? File.ReadAllLines(ConfigArq).Where(l => !l.StartsWith(k + "=")).ToList() : new List<string>();
        ls.Add(k + "=" + v);
        try { File.WriteAllLines(ConfigArq, ls.ToArray()); } catch { }
    }

    async void Prints(string pasta, string[] navs)
    {
        await Task.Delay(cenasLigadas ? 6000 : 300);  // (vídeo e fotos das cenas)
        foreach (var n in navs)
        {
            F<RadioButton>("nav" + n).IsChecked = true;
            Win.UpdateLayout();
            await Task.Delay(450);  // (animações dos interruptores e do menu)
            var root = (FrameworkElement)Win.Content;
            // a margem da janela (sombra) entra na imagem
            var rtb = new RenderTargetBitmap((int)Win.ActualWidth, (int)Win.ActualHeight, 96, 96, PixelFormats.Pbgra32);
            rtb.Render(root);
            var enc = new PngBitmapEncoder(); enc.Frames.Add(BitmapFrame.Create(rtb));
            using (var fs = File.Create(Path.Combine(pasta, "pg_" + n + ".png"))) enc.Save(fs);
        }
        Win.Close();
    }
}
