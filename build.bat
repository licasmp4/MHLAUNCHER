@echo off
rem Compila o MHGU Launcher e o instalador com o compilador C# do Windows (.NET Framework 4).
rem As fontes Inter (launcher\fonts, licenca SIL OFL 1.1) vao embutidas no exe do launcher.
rem Icone opcional: coloque um mhgu.ico nesta pasta (ele nao vai para o repositorio).
setlocal enabledelayedexpansion
set FW=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319
set REFS=/r:"%FW%\WPF\PresentationFramework.dll" /r:"%FW%\WPF\PresentationCore.dll" /r:"%FW%\WPF\WindowsBase.dll" /r:"%FW%\System.Xaml.dll" /r:System.dll /r:System.Core.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll
set ICON=
if exist "%~dp0mhgu.ico" set ICON=/win32icon:"%~dp0mhgu.ico"
if not exist "%~dp0dist" mkdir "%~dp0dist"

pushd "%~dp0launcher"
set FONTES=
for %%f in (fonts\*.ttf) do set FONTES=!FONTES! /resource:fonts\%%~nxf,fonte.%%~nxf
"%FW%\csc.exe" /nologo /codepage:65001 /target:winexe /optimize+ %ICON% /resource:Main.xaml,Main.xaml !FONTES! %REFS% /r:System.Management.dll /out:"%~dp0dist\MHGU Launcher.exe" Launcher.cs || goto erro
popd

pushd "%~dp0instalador"
"%FW%\csc.exe" /nologo /codepage:65001 /target:winexe /optimize+ %ICON% /resource:Setup.xaml,Setup.xaml %REFS% /r:System.Windows.Forms.dll /r:Microsoft.CSharp.dll /out:"%~dp0dist\Instalar MHGU.exe" Setup.cs || goto erro
popd

echo.
echo Pronto: dist\MHGU Launcher.exe e dist\Instalar MHGU.exe
exit /b 0

:erro
popd
echo.
echo Falhou a compilacao.
exit /b 1
