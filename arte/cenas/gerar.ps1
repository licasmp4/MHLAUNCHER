# Gera os sprites das cenas do cabeçalho (js/cenas-pixel.js) a partir das artes da Tainá (32x32, JPEG com fundo preto):
#   martelo.png         5 poses de 32x32 (levantado, descendo com rastro, batendo, recuo, subindo), girando em volta da mão
#   ampulheta-base.png  a ampulheta vazia, 32x38 (a tampa de cima espelhada embaixo, para ela poder virar)
#   ampulheta-cima.png  a areia cheia em cima; ampulheta-baixo.png  os mesmos grãos em monte embaixo
#   ampulheta-giro.png  3 quadros de 50x50 da virada (45, 90 e 135 graus)
# Giro sem estragar o pixel: RotSprite (Px.cs). Rodar no PowerShell do Windows:  .\arte\cenas\gerar.ps1
$aqui = $PSScriptRoot; $saida = Join-Path $aqui "..\..\app\src\renderer\img\pixel\cenas"
Add-Type -Path "$aqui\Px.cs" -ReferencedAssemblies System.Drawing
function Hx($h) { [Px]::FromHex($h) }
function Opaco($a) { $w = $a.GetLength(0); $h = $a.GetLength(1); for ($y = 0; $y -lt $h; $y++) { for ($x = 0; $x -lt $w; $x++) { if ((($a[$x, $y] -shr 24) -band 255) -eq 0) { $a[$x, $y] = 0 } } } }

# ===== martelo: o desenho limpo à mão sobre o original (o JPEG tem ruído); os escuros sobem um pouco para aparecer no
# fundo da floresta à noite, e a borda de luz de cima/esquerda do desenho fica mais visível
$cores = New-Object 'System.Collections.Generic.Dictionary[char,string]'
@{ [char]'o' = "#4a4552"; [char]'d' = "#2b2631"; [char]'s' = "#221f27"; [char]'l' = "#807b82"; [char]'h' = "#98969b"; [char]'f' = "#4d4751"
   [char]'g' = "#66606a"; [char]'m' = "#5a5664"; [char]'k' = "#3a3640"; [char]'w' = "#6a6874"; [char]'p' = "#8e8c90" }.GetEnumerator() | ForEach-Object { $cores[$_.Key] = $_.Value }
$grade = @(
  "................",
  "........oo......",
  ".......oddd.....",
  "......oddddd....",
  ".....oddddddh...",
  ".....ddddddlfh..",
  "......odddlfggh.",
  ".......ddsfgmggm",
  "........dfgmgmgm",
  ".......k.sfgmgm.",
  "......w...sfgm..",
  ".....w.....sf...",
  "....w...........",
  "...k............",
  "..k.............",
  ".p.............."
)
# a cabeça (o cabo, a diagonal x+y=16, é redesenhado em cada pose para não falhar no giro)
$cabeca = [Px]::Blank(16, 16)
for ($y = 0; $y -lt 16; $y++) { for ($x = 0; $x -lt 16; $x++) { $ch = $grade[$y][$x]; if ($ch -ne '.' -and -not ($x + $y -eq 16 -and $x -le 7)) { $cabeca[$x, $y] = Hx $cores[$ch] } } }

$piv = @(2.5, 14.5); $cel = 32; $ox = 8.5; $oy = 24.5; $pomo0 = @(1.5, 15.5); $junta0 = @(8.5, 8.5)
function Gira($p, $a) { $t = $a * [Math]::PI / 180; $dx = $p[0] - $piv[0]; $dy = $p[1] - $piv[1]
  @(($dx * [Math]::Cos($t) - $dy * [Math]::Sin($t) + $ox), ($dx * [Math]::Sin($t) + $dy * [Math]::Cos($t) + $oy)) }
# cabo: linha de pixel do pomo à cabeça, com o padrão do desenho: pomo, amarração, madeira, amarração
function Cabo($img, $a) {
  $p = Gira $pomo0 $a; $j = Gira $junta0 $a
  $x0 = [int][Math]::Floor($p[0]); $y0 = [int][Math]::Floor($p[1]); $x1 = [int][Math]::Floor($j[0]); $y1 = [int][Math]::Floor($j[1])
  $dx = [Math]::Abs($x1 - $x0); $dy = -[Math]::Abs($y1 - $y0); $sx = if ($x0 -lt $x1) { 1 } else { -1 }; $sy = if ($y0 -lt $y1) { 1 } else { -1 }; $err = $dx + $dy
  $pts = @(); while ($true) { $pts += , @($x0, $y0); if ($x0 -eq $x1 -and $y0 -eq $y1) { break }; $e2 = 2 * $err; if ($e2 -ge $dy) { $err += $dy; $x0 += $sx }; if ($e2 -le $dx) { $err += $dx; $y0 += $sy } }
  $n = $pts.Count
  for ($i = 0; $i -lt $n; $i++) { $t = $i / [Math]::Max(1, $n - 1)
    $c = if ($i -eq 0) { "#8e8c90" } elseif ($t -lt .34) { "#3a3640" } elseif ($t -lt .86) { "#6a6874" } else { "#3a3640" }
    $img[$pts[$i][0], $pts[$i][1]] = Hx $c }
}
# rastro do golpe: dois arcos atrás da cabeça
function Rastro($img, [int]$a, [int]$b) {
  foreach ($r in @(@(13.2, "#4d5260"), @(11.4, "#7c7f8a"))) {
    for ($g = $a; $g -le $b; $g += 2) { $t = $g * [Math]::PI / 180
      $x = [int][Math]::Floor($ox + $r[0] * [Math]::Cos($t)); $y = [int][Math]::Floor($oy + $r[0] * [Math]::Sin($t))
      if ($x -ge 0 -and $y -ge 0 -and $x -lt $cel -and $y -lt $cel -and $img[$x, $y] -eq 0) { $img[$x, $y] = Hx $r[1] } } }
}
$poses = @(@(-50, $false), @(-5, $true), @(38, $false), @(24, $false), @(-22, $false))
$martelo = [Px]::Blank($cel * $poses.Count, $cel); $i = 0
foreach ($pose in $poses) {
  $a = $pose[0]; $f = [Px]::Blank($cel, $cel)
  if ($pose[1]) { Rastro $f -88 -62 }
  Cabo $f $a
  [Px]::Blit($f, [Px]::Rot($cabeca, $a, $piv[0], $piv[1], $cel, $cel, $ox, $oy), 0, 0)
  [Px]::Blit($martelo, $f, $cel * $i, 0); $i++
}
[Px]::Save($martelo, "$saida\martelo.png")

# ===== ampulheta: as cores do JPEG reduzidas a 22 (k-means), as paredes e tampas do desenho, o miolo repintado
$q = [Px]::KeyBlack([Px]::Load("$aqui\ampulheta-original.jpeg"), 30); $q = [Px]::Quantize($q, [Px]::KMeans($q, 22)); Opaco $q
$W = 32; $Hh = 38
$cor = @{ M = (Hx "#a4b0d0"); I = (Hx "#998d98"); O = (Hx "#5f69b5"); Q = (Hx "#6b6386"); C = (Hx "#d2a071"); P = (Hx "#e0b194"); S = (Hx "#aa7a4d"); V = (Hx "#08142d") }
$base = [Px]::Blank($W, $Hh)
for ($y = 0; $y -le 6; $y++) { for ($x = 0; $x -lt $W; $x++) { $base[$x, $y] = $q[$x, $y]; $base[$x, (37 - $y)] = $q[$x, $y] } }
$miolo = @{}
for ($y = 7; $y -le 30; $y++) {
  $xs = @(); for ($x = 0; $x -lt $W; $x++) { if ($q[$x, $y] -ne 0) { $xs += $x } }
  $x0 = $xs[0]; $x1 = $xs[-1]
  $base[$x0, $y] = $cor.V; $base[$x1, $y] = $cor.V; $base[($x0 + 1), $y] = $cor.M; $base[($x1 - 1), $y] = $cor.I
  $a = $x0 + 2; $b = $x1 - 2; $miolo[$y] = @($a, $b)
  for ($x = $a; $x -le $b; $x++) { $base[$x, $y] = $cor.O }
  if ($b - $a -ge 5) { $base[$a, $y] = $cor.M; $base[$b, $y] = $cor.Q }
}
for ($x = $miolo[7][0]; $x -le $miolo[7][1]; $x++) { if ($x % 2) { $base[$x, 7] = $cor.Q } }

# areia de cima: o miolo das linhas 10 a 17, com as cores do desenho onde já era areia
$tonsAreia = @((Hx "#d2a071"), (Hx "#e0b194"), (Hx "#aa7a4d"), (Hx "#93766b"))
$cima = [Px]::Blank($W, $Hh); $n = 0
for ($y = 10; $y -le 17; $y++) { for ($x = $miolo[$y][0]; $x -le $miolo[$y][1]; $x++) { $c = $q[$x, $y]; $cima[$x, $y] = if ($tonsAreia -contains $c) { $c } else { $cor.C }; $n++ } }
# areia de baixo: os mesmos grãos em monte; a ordem (30 - y) + 0,55·|x - 15,5| é a mesma de cenas-pixel.js
$cands = @(); for ($y = 21; $y -le 30; $y++) { for ($x = $miolo[$y][0]; $x -le $miolo[$y][1]; $x++) { $cands += , @($x, $y, ((30 - $y) + 0.55 * [Math]::Abs($x - 15.5))) } }
$cands = $cands | Sort-Object { $_[2] } | Select-Object -First $n
$baixo = [Px]::Blank($W, $Hh)
foreach ($p in $cands) { $x = $p[0]; $y = $p[1]; $baixo[$x, $y] = if ($y -ge 29 -and (($x + $y) % 2 -eq 0)) { $cor.S } elseif ((($x * 7 + $y * 3) % 11) -eq 0) { $cor.P } else { $cor.C } }
"areia: $n grãos; monte cheio = {0} (AREIA_MONTE em cenas-pixel.js precisa ser maior)" -f ($cands[-1][2])
[Px]::Save($base, "$saida\ampulheta-base.png"); [Px]::Save($cima, "$saida\ampulheta-cima.png"); [Px]::Save($baixo, "$saida\ampulheta-baixo.png")

$cheia = [Px]::Blank($W, $Hh); [Px]::Blit($cheia, $base, 0, 0); [Px]::Blit($cheia, $baixo, 0, 0)
$giro = [Px]::Blank(150, 50); $i = 0
foreach ($a in 45, 90, 135) { [Px]::Blit($giro, [Px]::Rot($cheia, $a, 16, 19, 50, 50, 25, 25), 50 * $i, 0); $i++ }
[Px]::Save($giro, "$saida\ampulheta-giro.png")
"pronto: $((Resolve-Path $saida).Path)"
