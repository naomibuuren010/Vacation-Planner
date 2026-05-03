# Vacation Planner op GitHub (repo + GitHub Pages)

Je kunt dit project gratis hosten op **GitHub Pages**. Onderstaande stappen gaan uit van een **publieke** repository (gratis).

## 1. Git installeren (eenmalig op Windows)

Als `git` in PowerShell onbekend is:

1. Download **Git for Windows**: https://git-scm.com/download/win  
2. Installeer (mag de standaardopties).  
3. **Sluit en open PowerShell opnieuw** (of Cursor), daarna:

```powershell
git --version
```

## 2. Repository op GitHub aanmaken (website)

1. Ga naar https://github.com en log in.  
2. Rechtsboven **+** → **New repository**.  
3. **Repository name**: bijvoorbeeld `vacation-planner` (kleine letters, geen spaties).  
4. **Public** aanvinken.  
5. **Add a README** uit laten (je hebt al bestanden lokaal).  
6. Klik **Create repository**.

GitHub toont daarna een URL, bijvoorbeeld:

`https://github.com/JOUWNAAM/vacation-planner.git`

## 3. Eerste upload vanaf je pc (PowerShell)

Open PowerShell in je projectmap (pas het pad aan als nodig):

```powershell
cd "C:\Users\Eigenaar\Documents\Cursor\Apps\Vacation planner"
git init
git branch -M main
git add index.html app.js styles.css sw.js manifest.webmanifest icon.svg HANDOVER.md .gitignore GITHUB-SETUP.md
git commit -m "Initial commit: Vacation Planner PWA"
git remote add origin https://github.com/JOUWNAAM/vacation-planner.git
git push -u origin main
```

- Vervang `JOUWNAAM` door je echte GitHub-gebruikersnaam.  
- Bij de eerste `push` vraagt GitHub om inloggen (browser of **Personal Access Token** in plaats van wachtwoord).

**Swift-bestanden** (oude iOS-code) staan bewust **niet** in bovenstaande `git add`; die heb je voor de PWA niet nodig op GitHub Pages. Wil je ze wél in de repo, gebruik dan:

```powershell
git add .
```

## 4. GitHub Pages inschakelen

1. Op GitHub: open je repo → **Settings** → **Pages** (linkermenu).  
2. Onder **Build and deployment**:  
   - **Source**: **Deploy from a branch**  
   - **Branch**: `main` en map **`/ (root)`**  
3. **Save**.

Na 1–2 minuten staat de site op een URL als:

`https://JOUWNAAM.github.io/vacation-planner/`

(Open die link; eerste keer eventueel **Ctrl+F5** voor cache.)

## 5. Later wijzigingen doorvoeren

Na elke wijziging in Cursor:

```powershell
cd "C:\Users\Eigenaar\Documents\Cursor\Apps\Vacation planner"
git add -A
git status
git commit -m "Korte omschrijving van de wijziging"
git push
```

GitHub Pages bouwt opnieuw na elke push naar `main`.

## Tips

- **Private repo + Pages** kan op een gratis account beperkt zijn; **publiek** is het simpelste voor gratis hosting.  
- Je **vakantiedata** (`localStorage`) staat **alleen op het apparaat** van de bezoeker, niet in GitHub.  
- Als je **GitHub Desktop** liever hebt dan de command line: zelfde stappen (repository klonen, bestanden in de map, commit, push).
