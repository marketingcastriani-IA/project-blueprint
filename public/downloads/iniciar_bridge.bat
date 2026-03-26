@echo off
title ProfitRTD Bridge v2.0 - OpcoesProx
color 0B

:: Muda para o diretório deste .bat (corrige problema de caminho)
cd /d "%~dp0"

echo.
echo  ================================================
echo   ProfitRTD Bridge v2.0 - OpcoesProx.com.br
echo   Profit Pro - COM direto - WebSocket
echo   SEM necessidade de Excel!
echo  ================================================
echo.
echo  [INFO] Diretorio: %CD%
echo.

:: ── Verifica arquivos ──
if not exist "ProfitRTDBridge.csproj" (
    echo  [ERRO] ProfitRTDBridge.csproj nao encontrado nesta pasta!
    echo  Coloque todos os arquivos juntos na mesma pasta.
    pause & exit /b 1
)
if not exist "ProfitRTDBridge.cs" (
    echo  [ERRO] ProfitRTDBridge.cs nao encontrado nesta pasta!
    pause & exit /b 1
)

:: ── Verifica .NET SDK ──
dotnet --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERRO] .NET SDK nao encontrado!
    echo.
    echo  Instale o .NET 6 SDK (gratuito):
    echo  https://dotnet.microsoft.com/download/dotnet/6.0
    echo.
    echo  Apos instalar, reinicie e execute este .bat novamente.
    pause & exit /b 1
)

for /f "tokens=*" %%v in ('dotnet --version') do set DOTNET_VER=%%v
echo  [OK] .NET SDK v%DOTNET_VER% encontrado.
echo.

set PORT=8765

:: ── Se ja existe .exe publicado, usa ele direto (mais rapido) ──
if exist "publish\ProfitRTDBridge.exe" (
    echo  [OK] Executavel publicado encontrado. Iniciando direto...
    echo.
    goto :run_exe
)

:: ── Restaura pacotes NuGet ──
echo  [INFO] Baixando dependencias (Fleck + Newtonsoft.Json)...
dotnet restore ProfitRTDBridge.csproj --verbosity quiet
if %errorlevel% neq 0 (
    echo  [ERRO] Falha ao baixar dependencias. Verifique sua conexao com a internet.
    pause & exit /b 1
)
echo  [OK] Dependencias prontas.
echo.

:: ── Pergunta se quer gerar .exe único (só na primeira vez) ──
echo  Deseja gerar um .exe unico (sem precisar do .NET instalado)?
echo  [S] Sim - gera ProfitRTDBridge.exe (~60MB, roda em qualquer Windows)
echo  [N] Nao - roda com dotnet run (mais rapido agora, precisa do .NET SDK)
echo.
set /p CHOICE="Escolha [S/N]: "
if /i "%CHOICE%"=="S" goto :publish
goto :run_dotnet

:publish
echo.
echo  [INFO] Publicando como .exe unico (aguarde ~30 segundos)...
dotnet publish ProfitRTDBridge.csproj -c Release -r win-x64 --self-contained true ^
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true ^
    -o publish --verbosity quiet
if %errorlevel% neq 0 (
    echo  [ERRO] Falha ao publicar. Tentando rodar com dotnet run...
    goto :run_dotnet
)
echo  [OK] Publicado em: %CD%\publish\ProfitRTDBridge.exe
echo  [INFO] Proximas vezes sera iniciado direto sem compilar!
goto :run_exe

:run_exe
echo  [INFO] Iniciando bridge (porta %PORT%)...
echo.
echo  IMPORTANTE: Abra o Profit Pro antes de continuar!
echo  Acesse: https://opcoesprox.com.br/dados-ao-vivo
echo.
"publish\ProfitRTDBridge.exe" --port %PORT%
goto :end

:run_dotnet
echo.
echo  [INFO] Compilando e iniciando (porta %PORT%)...
echo.
echo  IMPORTANTE: Abra o Profit Pro antes de continuar!
echo  Acesse: https://opcoesprox.com.br/dados-ao-vivo
echo.
dotnet run --project ProfitRTDBridge.csproj -c Release -- --port %PORT%

:end
echo.
echo  Bridge encerrado.
pause
