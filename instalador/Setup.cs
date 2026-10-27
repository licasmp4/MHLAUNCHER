// Instalador do MHGU para PC (MHGURecomp + tradução pt-BR + HD + HUD de caça + launcher), passo a passo.
// Não inclui o jogo: usa a cópia da pessoa (XCI + update 1.4.0 + prod.keys, ou exefs/romfs já extraídos).
// Layout em Setup.xaml (recurso embutido). Arquivos do pacote ficam em "arquivos\" ao lado do exe.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Windows.Media;
using System.Windows.Media.Imaging;

[assembly: System.Reflection.AssemblyTitle("Instalador MHGU")]
[assembly: System.Reflection.AssemblyProduct("MHGU pt-BR (licas.mp3)")]

// Prioridade de tarefa de fundo: a extração lê e grava ~36 GB e, em prioridade normal, deixava o disco a 100% e
// o PC inteiro travado. Em fundo o Windows atende primeiro os outros programas (disco e processador).
static class Fundo
{
    [System.Runtime.InteropServices.DllImport("kernel32.dll")] static extern IntPtr GetCurrentThread();
    [System.Runtime.InteropServices.DllImport("kernel32.dll")] static extern bool SetThreadPriority(IntPtr t, int p);
    [System.Runtime.InteropServices.DllImport("ntdll.dll")] static extern int NtSetInformationProcess(IntPtr p, int classe, ref int valor, int tam);
    const int THREAD_MODE_BACKGROUND_BEGIN = 0x00010000, ProcessIoPriority = 33, IO_BAIXA = 1;
    public static void EstaThread() { try { SetThreadPriority(GetCurrentThread(), THREAD_MODE_BACKGROUND_BEGIN); } catch { } }
    public static void Processo(Process p)
    {
        try { p.PriorityClass = ProcessPriorityClass.BelowNormal; } catch { }
        try { int v = IO_BAIXA; NtSetInformationProcess(p.Handle, ProcessIoPriority, ref v, 4); } catch { }
    }
}

class App
{
    [STAThread]
    static int Main(string[] args)
    {
        var app = new Application();
        Setup s;
        try { s = new Setup(args); } catch (Exception ex) { MessageBox.Show(ex.ToString(), "Instalador MHGU"); return 1; }
        app.Run(s.Win);
        return s.Codigo;
    }
}

class Setup
{
    public Window Win;
    public int Codigo;
    string Dir = AppDomain.CurrentDomain.BaseDirectory;
    string Pacote { get { return Path.Combine(Dir, "arquivos"); } }
    int pagina;
    bool instalando, auto;
    string[] etapas = { "Bem-vindo", "Pasta", "Seu jogo", "Instalação", "Pronto" };
    const long ROMFS_BYTES = 12311983212;   // romfs 1.4.0 completo (base + update)

    T F<T>(string n) where T : class { return Win.FindName(n) as T; }
    Brush B(string k) { return (Brush)Win.FindResource(k); }

    public Setup(string[] args)
    {
        using (var s = typeof(Setup).Assembly.GetManifestResourceStream("Setup.xaml")) Win = (Window)XamlReader.Load(s);
        try
        {
            var ico = Path.Combine(Pacote, "mhgu.ico");
            var dec = BitmapDecoder.Create(new Uri(ico), BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
            var img = dec.Frames.OrderByDescending(f => f.PixelWidth).First();
            F<ImageBrush>("imgLogo").ImageSource = img; Win.Icon = img;
        }
        catch { }
        F<Border>("titleBar").MouseLeftButtonDown += (s, e) => Win.DragMove();
        F<Button>("btnMin").Click += (s, e) => Win.WindowState = WindowState.Minimized;
        F<Button>("btnClose").Click += (s, e) =>
        {
            if (instalando && MessageBox.Show("A instalação está rodando. Cancelar e fechar?", "Instalador MHGU", MessageBoxButton.YesNo) != MessageBoxResult.Yes) return;
            Win.Close();
        };
        F<Button>("btnNext").Click += (s, e) => Avancar();
        F<Button>("btnBack").Click += (s, e) => { if (pagina == 4) Win.Close(); else if (pagina > 0) Ir(pagina - 1); };

        // pasta
        F<TextBox>("txtDest").Text = @"C:\MHGURecomp";
        F<TextBox>("txtDest").TextChanged += (s, e) => Espaco();
        F<Button>("btnDest").Click += (s, e) =>
        {
            var d = new System.Windows.Forms.FolderBrowserDialog { Description = "Escolha onde instalar o MHGU", SelectedPath = F<TextBox>("txtDest").Text };
            if (d.ShowDialog() == System.Windows.Forms.DialogResult.OK) F<TextBox>("txtDest").Text = d.SelectedPath.TrimEnd('\\').EndsWith("MHGURecomp", StringComparison.OrdinalIgnoreCase) ? d.SelectedPath : Path.Combine(d.SelectedPath, "MHGURecomp");
        };

        // jogo
        F<RadioButton>("rbFiles").Checked += (s, e) => Modo();
        F<RadioButton>("rbDump").Checked += (s, e) => Modo();
        F<Button>("btnXci").Click += (s, e) => Arquivo("txtXci", "Escolha o jogo base (.xci)", "Jogo base (*.xci)|*.xci|Todos|*.*");
        F<Button>("btnNsp").Click += (s, e) => Arquivo("txtNsp", "Escolha o update 1.4.0 (.nsp)", "Update (*.nsp)|*.nsp|Todos|*.*");
        F<Button>("btnKeys").Click += (s, e) => Arquivo("txtKeys", "Escolha o prod.keys", "prod.keys|*.keys|Todos|*.*");
        F<Button>("btnKeysAuto").Click += (s, e) =>
        {
            var k = AcharKeys();
            if (k != null) F<TextBox>("txtKeys").Text = k;
            else MessageBox.Show("Não achei o prod.keys nas pastas do Eden, yuzu ou Ryujinx.\nClique em Procurar e escolha o arquivo.", "Instalador MHGU");
        };
        F<Button>("btnDump").Click += (s, e) =>
        {
            var d = new System.Windows.Forms.FolderBrowserDialog { Description = "Escolha a pasta que contém exefs e romfs" };
            if (d.ShowDialog() == System.Windows.Forms.DialogResult.OK) F<TextBox>("txtDump").Text = d.SelectedPath;
        };
        foreach (var n in new[] { "txtXci", "txtNsp", "txtKeys", "txtDump" }) F<TextBox>(n).TextChanged += (s, e) => Conferir();
        var kAuto = AcharKeys(); if (kAuto != null) F<TextBox>("txtKeys").Text = kAuto;

        Ir(0);

        // teste: --prints <pasta> salva as páginas 1, 2, 3 e 5 como imagem
        int ip = Array.IndexOf(args, "--prints");
        if (ip >= 0 && ip + 1 < args.Length)
            Win.ContentRendered += (s, e) =>
            {
                foreach (int p in new[] { 0, 1, 2, 4 })
                {
                    Ir(p); if (p == 4) F<TextBlock>("txtDone").Text = @"Instalado em C:\MHGURecomp\Windows-MHGURecomp. O atalho ""MHGU PC (pt-BR HD)"" está na sua área de trabalho.";
                    Win.UpdateLayout(); Win.Dispatcher.Invoke(() => { }, System.Windows.Threading.DispatcherPriority.Render);
                    var root = (FrameworkElement)Win.Content;
                    var rtb = new RenderTargetBitmap((int)root.ActualWidth, (int)root.ActualHeight, 96, 96, PixelFormats.Pbgra32); rtb.Render(root);
                    var enc = new PngBitmapEncoder(); enc.Frames.Add(BitmapFrame.Create(rtb));
                    using (var fs = File.Create(Path.Combine(args[ip + 1], "setup" + p + ".png"))) enc.Save(fs);
                }
                Win.Close();
            };

        // teste: --auto <pasta> <xci> <nsp> <keys>
        int ia = Array.IndexOf(args, "--auto");
        if (ia >= 0 && ia + 4 < args.Length)
        {
            auto = true;
            F<TextBox>("txtDest").Text = args[ia + 1]; F<TextBox>("txtXci").Text = args[ia + 2]; F<TextBox>("txtNsp").Text = args[ia + 3]; F<TextBox>("txtKeys").Text = args[ia + 4];
            Win.ContentRendered += (s, e) => { Ir(2); Avancar(); };
        }
    }

    // ---------- navegação
    void Ir(int p)
    {
        pagina = p;
        for (int i = 0; i < 5; i++) F<FrameworkElement>("pg" + i).Visibility = i == p ? Visibility.Visible : Visibility.Collapsed;
        var sp = F<StackPanel>("stepsPanel"); sp.Children.Clear();
        for (int i = 0; i < etapas.Length; i++)
        {
            var g = new Grid { Margin = new Thickness(0, 0, 0, 14) };
            g.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(40) }); g.ColumnDefinitions.Add(new ColumnDefinition());
            bool feito = i < p, atual = i == p;
            var bola = new Border { Width = 28, Height = 28, CornerRadius = new CornerRadius(14), Background = feito ? B("Ok") : atual ? B("Gold") : B("CardHi"), HorizontalAlignment = HorizontalAlignment.Left };
            bola.Child = new TextBlock { Text = feito ? "\uE73E" : (i + 1).ToString(), FontFamily = feito ? new FontFamily("Segoe MDL2 Assets") : new FontFamily("Segoe UI"), FontSize = feito ? 12 : 13, FontWeight = FontWeights.Bold, Foreground = feito || atual ? (Brush)new SolidColorBrush(Color.FromRgb(0x1A, 0x12, 0x05)) : B("Sub"), HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
            g.Children.Add(bola);
            var t = new TextBlock { Text = etapas[i], FontSize = 14, FontWeight = atual ? FontWeights.SemiBold : FontWeights.Normal, Foreground = atual ? B("Text") : B("Sub"), VerticalAlignment = VerticalAlignment.Center };
            Grid.SetColumn(t, 1); g.Children.Add(t); sp.Children.Add(g);
        }
        var next = F<Button>("btnNext"); var back = F<Button>("btnBack");
        back.Visibility = p == 0 || p == 3 ? Visibility.Collapsed : Visibility.Visible;
        back.Content = p == 4 ? "Fechar" : "Voltar";
        next.Visibility = p == 3 ? Visibility.Collapsed : Visibility.Visible;
        next.Content = p == 0 ? "Começar" : p == 2 ? "Instalar" : p == 4 ? "Abrir o MHGU Launcher" : "Continuar";
        F<TextBlock>("txtFooter").Text = p == 2 ? "" : p == 1 ? "" : "";
        if (p == 1) Espaco();
        if (p == 2) { Modo(); Conferir(); }
    }

    void Avancar()
    {
        if (pagina == 0) { Ir(1); return; }
        if (pagina == 1)
        {
            string d = F<TextBox>("txtDest").Text.Trim();
            if (d.Length < 4 || !Path.IsPathRooted(d)) { MessageBox.Show("Escolha uma pasta válida (ex.: C:\\MHGURecomp).", "Instalador MHGU"); return; }
            Ir(2); return;
        }
        if (pagina == 2)
        {
            if (!Conferir()) { if (!auto) MessageBox.Show("Ainda falta escolher algum arquivo (os que não têm ✓).", "Instalador MHGU"); else { Codigo = 2; Win.Close(); } return; }
            Ir(3); Instalar(); return;
        }
        if (pagina == 4)
        {
            string l = Path.Combine(portDir, "MHGU Launcher.exe");
            if (File.Exists(l)) Process.Start(new ProcessStartInfo(l) { WorkingDirectory = portDir, UseShellExecute = true });
            Win.Close();
        }
    }

    void Espaco()
    {
        string d = F<TextBox>("txtDest").Text.Trim(); var t = F<TextBlock>("txtSpace");
        try
        {
            var drv = new DriveInfo(Path.GetPathRoot(d));
            double livre = drv.AvailableFreeSpace / 1e9;
            bool jaTem = File.Exists(Path.Combine(d, "Windows-MHGURecomp", "data", "romfs", "nativeNX", "arc", "quest", "q0000000.arc")) || Directory.Exists(Path.Combine(d, "Windows-MHGURecomp", "data", "romfs", "nativeNX"));
            double precisa = jaTem ? 3 : 30;
            t.Text = "Espaço livre em " + drv.Name + ": " + livre.ToString("0") + " GB · precisa de ~" + precisa.ToString("0") + " GB" + (jaTem ? " (os arquivos do jogo já estão lá)" : " durante a instalação");
            t.Foreground = livre >= precisa ? B("Ok") : B("Bad");
        }
        catch { t.Text = "Pasta inválida."; t.Foreground = B("Bad"); }
    }

    void Modo()
    {
        bool arq = F<RadioButton>("rbFiles").IsChecked == true;
        F<FrameworkElement>("panelFiles").Visibility = arq ? Visibility.Visible : Visibility.Collapsed;
        F<FrameworkElement>("panelDump").Visibility = arq ? Visibility.Collapsed : Visibility.Visible;
        Conferir();
    }

    void Arquivo(string caixa, string titulo, string filtro)
    {
        var d = new Microsoft.Win32.OpenFileDialog { Title = titulo, Filter = filtro };
        if (d.ShowDialog() == true) F<TextBox>(caixa).Text = d.FileName;
    }

    static string AcharKeys()
    {
        string ad = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        string up = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        var c = new List<string>();
        foreach (var e in new[] { "eden", "yuzu", "citron", "sudachi", "suyu", "torzu" }) c.Add(Path.Combine(ad, e, "keys", "prod.keys"));
        c.Add(Path.Combine(ad, "Ryujinx", "system", "prod.keys"));
        c.Add(Path.Combine(up, ".switch", "prod.keys"));
        return c.FirstOrDefault(f => File.Exists(f) && ValidaKeys(f) == null);
    }

    // ---------- conferência dos arquivos (devolve null se ok, ou o motivo)
    static string ValidaXci(string f)
    {
        if (!File.Exists(f)) return "arquivo não encontrado";
        if (f.EndsWith(".nsp", StringComparison.OrdinalIgnoreCase)) return "jogo base em .nsp ainda não é suportado: use o .xci ou a opção 'Já extraí pelo emulador'";
        long t = new FileInfo(f).Length;
        var h = new byte[4];
        using (var s = File.OpenRead(f)) { s.Seek(0x100, SeekOrigin.Begin); s.Read(h, 0, 4); }
        if (Encoding.ASCII.GetString(h) != "HEAD") return "não parece um .xci válido";
        if (t < 8L << 30) return "pequeno demais para o MHGU (" + (t / 1e9).ToString("0.0") + " GB)";
        return null;
    }
    static string ValidaNsp(string f)
    {
        if (!File.Exists(f)) return "arquivo não encontrado";
        long t = new FileInfo(f).Length;
        var h = new byte[0x4000];
        int n; using (var s = File.OpenRead(f)) n = s.Read(h, 0, h.Length);
        if (Encoding.ASCII.GetString(h, 0, 4) != "PFS0") return "não parece um .nsp válido";
        string nomes = Encoding.ASCII.GetString(h, 0, n).ToLowerInvariant();
        if (!nomes.Contains("0100770008dd8800")) return nomes.Contains("0100770008dd8000") ? "esse é o jogo base, não o update" : "não é o update do MHGU";
        if (t > 1L << 30) return "grande demais para o update 1.4.0";
        return null;
    }
    static string ValidaKeys(string f)
    {
        if (!File.Exists(f)) return "arquivo não encontrado";
        try
        {
            var l = File.ReadAllLines(f);
            if (!l.Any(x => x.TrimStart().StartsWith("header_key"))) return "não tem header_key: não é um prod.keys";
            if (!l.Any(x => x.TrimStart().StartsWith("key_area_key_application_"))) return "incompleto (faltam as key_area_key)";
        }
        catch { return "não consegui ler"; }
        return null;
    }
    static string ValidaDump(string d)
    {
        if (!Directory.Exists(d)) return "pasta não encontrada";
        if (!File.Exists(Path.Combine(d, "exefs", "main"))) return "não tem exefs\\main";
        if (!Directory.Exists(Path.Combine(d, "romfs", "nativeNX"))) return "não tem romfs\\nativeNX";
        return null;
    }
    bool Marca(string rotulo, string caminho, Func<string, string> valida, string okTexto)
    {
        var t = F<TextBlock>(rotulo);
        if (caminho.Length == 0) { t.Text = "falta escolher"; t.Foreground = B("Sub"); return false; }
        string erro; try { erro = valida(caminho); } catch (Exception ex) { erro = ex.Message; }
        t.Text = erro == null ? "✓ " + okTexto : "✗ " + erro;
        t.Foreground = erro == null ? B("Ok") : B("Bad");
        return erro == null;
    }
    bool Conferir()
    {
        if (F<RadioButton>("rbFiles").IsChecked == true)
        {
            bool a = Marca("okXci", F<TextBox>("txtXci").Text, ValidaXci, "jogo base ok");
            bool b = Marca("okNsp", F<TextBox>("txtNsp").Text, ValidaNsp, "update do MHGU ok");
            bool c = Marca("okKeys", F<TextBox>("txtKeys").Text, ValidaKeys, "chaves ok");
            return a && b && c;
        }
        return Marca("okDump", F<TextBox>("txtDump").Text, ValidaDump, "exefs e romfs ok");
    }

    // ---------- instalação
    string portDir;
    List<Tuple<string, TextBlock, TextBlock>> tarefas = new List<Tuple<string, TextBlock, TextBlock>>();

    void Log(string t)
    {
        Win.Dispatcher.BeginInvoke(new Action(() => { F<TextBlock>("txtLog").Text += t + "\n"; F<ScrollViewer>("logScroll").ScrollToEnd(); }));
    }
    void Progresso(string agora, double pct)
    {
        Win.Dispatcher.BeginInvoke(new Action(() =>
        {
            if (agora != null) F<TextBlock>("txtNow").Text = agora;
            F<ProgressBar>("bar").Value = Math.Max(0, Math.Min(100, pct));
            F<TextBlock>("txtPct").Text = pct >= 0 ? ((int)pct) + "%" : "";
        }));
    }
    void Tarefa(int i, string estado)   // "", "rodando", "ok", "pulado", "erro"
    {
        Win.Dispatcher.BeginInvoke(new Action(() =>
        {
            var t = tarefas[i];
            t.Item2.Text = estado == "ok" ? "\uE73E" : estado == "erro" ? "\uE711" : estado == "rodando" ? "\uE768" : estado == "pulado" ? "\uE73E" : "\uE91F";
            t.Item2.Foreground = estado == "ok" || estado == "pulado" ? B("Ok") : estado == "erro" ? B("Bad") : estado == "rodando" ? B("Gold") : B("Sub");
            t.Item3.Foreground = estado == "rodando" ? B("Text") : B("Sub");
            if (estado == "pulado") t.Item3.Text = t.Item1 + " (já estava pronto)";
        }));
    }

    void Instalar()
    {
        instalando = true;
        string dest = F<TextBox>("txtDest").Text.Trim();
        bool arq = F<RadioButton>("rbFiles").IsChecked == true;
        string xci = F<TextBox>("txtXci").Text, nsp = F<TextBox>("txtNsp").Text, keys = F<TextBox>("txtKeys").Text, dump = F<TextBox>("txtDump").Text;
        var nomes = arq ? new[] { "Baixar o port MHGURecomp", "Baixar a ferramenta de extração", "Abrir o jogo base", "Abrir o update 1.4.0", "Extrair os arquivos do jogo (~12 GB)", "Instalar tradução, HD e HUD", "Launcher e atalho" }
                        : new[] { "Baixar o port MHGURecomp", "Copiar exefs e romfs (~12 GB)", "Instalar tradução, HD e HUD", "Launcher e atalho" };
        var lista = F<StackPanel>("taskList");
        foreach (var n in nomes)
        {
            var sp = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 3, 0, 3) };
            var ic = new TextBlock { FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 13, Width = 26, VerticalAlignment = VerticalAlignment.Center };
            var tx = new TextBlock { Text = n, FontSize = 13 };
            sp.Children.Add(ic); sp.Children.Add(tx); lista.Children.Add(sp);
            tarefas.Add(Tuple.Create(n, ic, tx));
        }
        for (int i = 0; i < nomes.Length; i++) Tarefa(i, "");

        Task.Run(() =>
        {
            Fundo.EstaThread();  // (cópias e downloads desta tarefa em prioridade de fundo)
            int etapa = 0;
            try
            {
                Directory.CreateDirectory(dest);
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

                // port
                Tarefa(etapa, "rodando");
                var exe = Directory.GetFiles(dest, "mhgurecomp.exe", SearchOption.AllDirectories).FirstOrDefault();
                if (exe != null) { Log("Port já instalado em " + Path.GetDirectoryName(exe)); Tarefa(etapa, "pulado"); }
                else
                {
                    Progresso("Procurando a versão mais nova do port...", 0);
                    var wc = new WebClient(); wc.Headers.Add("User-Agent", "MHGU-Instalador");
                    string api = wc.DownloadString("https://api.github.com/repos/morerokk/MHGURecomp/releases/latest");
                    var m = Regex.Match(api, "\"browser_download_url\"\\s*:\\s*\"([^\"]*Windows[^\"]*\\.zip)\"");
                    if (!m.Success) throw new Exception("não achei o download do port para Windows no GitHub");
                    string tag = Regex.Match(api, "\"tag_name\"\\s*:\\s*\"([^\"]+)\"").Groups[1].Value;
                    string zip = Path.Combine(dest, "port.zip");
                    Baixar(m.Groups[1].Value, zip, "Baixando o port MHGURecomp " + tag);
                    Progresso("Descompactando o port...", 100);
                    ZipFile.ExtractToDirectory(zip, dest); File.Delete(zip);
                    exe = Directory.GetFiles(dest, "mhgurecomp.exe", SearchOption.AllDirectories).First();
                    // o launcher compara esta versão com a do GitHub para oferecer atualização
                    File.WriteAllText(Path.Combine(Path.GetDirectoryName(exe), "versao_port.txt"), tag);
                    Log("MHGURecomp " + tag + " instalado"); Tarefa(etapa, "ok");
                }
                portDir = Path.GetDirectoryName(exe);
                string data = Path.Combine(portDir, "data");
                Directory.CreateDirectory(data); Directory.CreateDirectory(Path.Combine(portDir, "mods"));
                bool jogoPronto = File.Exists(Path.Combine(data, "exefs", "main")) && Directory.Exists(Path.Combine(data, "romfs", "nativeNX"));
                etapa++;

                if (arq)
                {
                    string tmp = Path.Combine(portDir, "_extracao");
                    if (jogoPronto) { for (int i = 0; i < 4; i++) { Tarefa(etapa + i, "pulado"); } etapa += 4; Log("Arquivos do jogo já estavam no port"); }
                    else
                    {
                        if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
                        Directory.CreateDirectory(tmp);
                        // hactool
                        Tarefa(etapa, "rodando");
                        string hz = Path.Combine(tmp, "hactool.zip");
                        Baixar("https://github.com/SciresM/hactool/releases/download/1.4.0/hactool-1.4.0-win.zip", hz, "Baixando o hactool");
                        ZipFile.ExtractToDirectory(hz, tmp);
                        string hac = Directory.GetFiles(tmp, "hactool.exe", SearchOption.AllDirectories).First();
                        // o hactool para em chaves de tamanho fora do padrão: fica só com as válidas
                        string kf = Path.Combine(tmp, "prod.keys");
                        File.WriteAllLines(kf, File.ReadAllLines(keys).Where(l => Regex.IsMatch(l, @"^\s*\w+\s*=\s*([0-9a-fA-F]+)\s*$") && Regex.Match(l, @"=\s*([0-9a-fA-F]+)").Groups[1].Value.Length % 32 == 0).ToArray());
                        Tarefa(etapa, "ok"); etapa++;

                        // base
                        Tarefa(etapa, "rodando");
                        string bdir = Path.Combine(tmp, "base");
                        // fim dos dados válidos do cartucho (cabeçalho 0x118, em blocos de 0x200): o .xci pode ter sobra vazia no fim
                        var cab = new byte[0x120];
                        using (var s = File.OpenRead(xci)) s.Read(cab, 0, cab.Length);
                        long xciTam = (long)BitConverter.ToUInt32(cab, 0x118) * 0x200;
                        if (xciTam <= 0 || xciTam > new FileInfo(xci).Length) xciTam = new FileInfo(xci).Length;
                        Hactool(hac, new[] { "-k", kf, "-t", "xci", "--securedir=" + bdir, xci }, "Abrindo o jogo base", bdir, (long)(xciTam * 0.99));
                        var bnca = MaiorNca(bdir);
                        if (bnca == null) throw new Exception("não consegui abrir o jogo base. O prod.keys é do mesmo Switch e está atualizado?");
                        Tarefa(etapa, "ok"); etapa++;

                        // update
                        Tarefa(etapa, "rodando");
                        string udir = Path.Combine(tmp, "update");
                        Hactool(hac, new[] { "-k", kf, "-t", "pfs0", "--outdir=" + udir, nsp }, "Abrindo o update 1.4.0", udir, new FileInfo(nsp).Length);
                        var unca = MaiorNca(udir);
                        var tik = Directory.GetFiles(udir, "*.tik").FirstOrDefault();
                        if (unca == null || tik == null) throw new Exception("não consegui abrir o update");
                        var tb = File.ReadAllBytes(tik);
                        string tk = BitConverter.ToString(tb, 0x180, 16).Replace("-", "").ToLowerInvariant();
                        Tarefa(etapa, "ok"); etapa++;

                        // romfs + exefs
                        Tarefa(etapa, "rodando");
                        Hactool(hac, new[] { "-k", kf, "--titlekey=" + tk, "--basenca=" + bnca, "--exefsdir=" + Path.Combine(data, "exefs"), "--romfsdir=" + Path.Combine(data, "romfs"), unca },
                                "Extraindo os arquivos do jogo", Path.Combine(data, "romfs"), ROMFS_BYTES);
                        if (!File.Exists(Path.Combine(data, "exefs", "main")) || !Directory.Exists(Path.Combine(data, "romfs", "nativeNX")))
                            throw new Exception("a extração falhou. O update é mesmo o 1.4.0?");
                        Log("exefs e romfs extraídos");
                        Directory.Delete(tmp, true);
                        Tarefa(etapa, "ok"); etapa++;
                    }
                }
                else
                {
                    Tarefa(etapa, "rodando");
                    if (jogoPronto) { Tarefa(etapa, "pulado"); }
                    else
                    {
                        long total = TamanhoPasta(Path.Combine(dump, "romfs")) + TamanhoPasta(Path.Combine(dump, "exefs")), feito = 0;
                        foreach (var p in new[] { "exefs", "romfs" }) CopiarPasta(Path.Combine(dump, p), Path.Combine(data, p), ref feito, total, "Copiando " + p);
                        Tarefa(etapa, "ok");
                    }
                    etapa++;
                }
                try { File.Delete(Path.Combine(data, "placeromfsexefsfoldershere.txt")); } catch { }

                // mods
                Tarefa(etapa, "rodando");
                var mods = Directory.GetDirectories(Path.Combine(Pacote, "mod"));
                long tm = mods.Sum(d => TamanhoPasta(d)), fm = 0;
                foreach (var m in mods)
                {
                    string alvo = Path.Combine(portDir, "mods", Path.GetFileName(m));
                    if (Directory.Exists(alvo)) Directory.Delete(alvo, true);
                    CopiarPasta(m, alvo, ref fm, tm, "Instalando " + Path.GetFileName(m));
                    Log("Mod instalado: " + Path.GetFileName(m));
                }
                Tarefa(etapa, "ok"); etapa++;

                // launcher + atalho
                Tarefa(etapa, "rodando");
                Progresso("Criando o atalho...", 100);
                foreach (var f in new[] { "MHGU Launcher.exe", "mhgu.ico" }) File.Copy(Path.Combine(Pacote, f), Path.Combine(portDir, f), true);
                string lnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), auto ? "MHGU teste instalador.lnk" : "MHGU PC (pt-BR HD).lnk");
                dynamic sh = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
                dynamic at = sh.CreateShortcut(lnk);
                at.TargetPath = Path.Combine(portDir, "MHGU Launcher.exe"); at.WorkingDirectory = portDir; at.IconLocation = Path.Combine(portDir, "mhgu.ico") + ",0"; at.Save();
                Log("Atalho criado: " + lnk);
                Tarefa(etapa, "ok");

                Win.Dispatcher.Invoke(() =>
                {
                    instalando = false;
                    F<TextBlock>("txtDone").Text = "Instalado em " + portDir + ". O atalho \"MHGU PC (pt-BR HD)\" está na sua área de trabalho.";
                    Ir(4);
                    if (auto) { Codigo = 0; Win.Close(); }
                });
            }
            catch (Exception ex)
            {
                Log("ERRO: " + ex.Message);
                Tarefa(Math.Min(etapa, tarefas.Count - 1), "erro");
                Win.Dispatcher.Invoke(() =>
                {
                    instalando = false;
                    F<TextBlock>("txtInstTitle").Text = "Deu um problema";
                    F<TextBlock>("txtInstTitle").Foreground = B("Bad");
                    F<TextBlock>("txtInstSub").Text = ex.Message + "  Feche e rode o instalador de novo depois de conferir os arquivos.";
                    if (auto) { Codigo = 3; Win.Close(); }
                });
            }
        });
    }

    void Baixar(string url, string arq, string texto)
    {
        using (var wc = new WebClient())
        {
            wc.Headers.Add("User-Agent", "MHGU-Instalador");
            var fim = new ManualResetEventSlim(); Exception erro = null;
            wc.DownloadProgressChanged += (s, e) => Progresso(texto + " (" + (e.BytesReceived / 1048576) + " MB)", e.ProgressPercentage);
            wc.DownloadFileCompleted += (s, e) => { erro = e.Error; fim.Set(); };
            Progresso(texto, 0);
            wc.DownloadFileAsync(new Uri(url), arq);
            fim.Wait();
            if (erro != null) throw new Exception("falha ao baixar (" + erro.Message + "). Confira a internet.");
        }
        Log(texto + ": ok");
    }

    // roda o hactool; o progresso é o tamanho da pasta de saída comparado ao esperado
    void Hactool(string hac, string[] args, string texto, string saida, long esperado)
    {
        var psi = new ProcessStartInfo(hac, string.Join(" ", args.Select(a => "\"" + a + "\""))) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        var p = Process.Start(psi);
        Fundo.Processo(p);
        p.OutputDataReceived += (s, e) => { }; p.ErrorDataReceived += (s, e) => { };
        p.BeginOutputReadLine(); p.BeginErrorReadLine();
        while (!p.WaitForExit(2500))  // (medir a pasta varre milhares de arquivos: não todo segundo)
        {
            long t = 0; try { t = TamanhoPasta(saida); } catch { }
            Progresso(texto + " (" + (t / 1e9).ToString("0.0") + " de " + (esperado / 1e9).ToString("0.0") + " GB)", esperado > 0 ? 100.0 * t / esperado : -1);
        }
        Log(texto + ": ok");
    }
    static string MaiorNca(string d)
    {
        if (!Directory.Exists(d)) return null;
        return Directory.GetFiles(d, "*.nca").Where(f => !f.EndsWith(".cnmt.nca")).OrderByDescending(f => new FileInfo(f).Length).FirstOrDefault();
    }
    static long TamanhoPasta(string d)
    {
        if (!Directory.Exists(d)) return 0;
        return Directory.EnumerateFiles(d, "*", SearchOption.AllDirectories).Sum(f => { try { return new FileInfo(f).Length; } catch { return 0L; } });
    }
    void CopiarPasta(string de, string para, ref long feito, long total, string texto)
    {
        Directory.CreateDirectory(para);
        foreach (var d in Directory.GetDirectories(de, "*", SearchOption.AllDirectories)) Directory.CreateDirectory(para + d.Substring(de.Length));
        int n = 0;
        foreach (var f in Directory.GetFiles(de, "*", SearchOption.AllDirectories))
        {
            File.Copy(f, para + f.Substring(de.Length), true);
            feito += new FileInfo(f).Length;
            if (++n % 50 == 0) Progresso(texto, total > 0 ? 100.0 * feito / total : -1);
        }
        Progresso(texto, total > 0 ? 100.0 * feito / total : 100);
    }
}
