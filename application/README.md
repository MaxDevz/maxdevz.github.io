Lancement facile avec un script

- Double-cliquez sur `application\start_gameapp.bat`
- ou exécutez dans PowerShell : `.\application\start_gameapp.ps1`
- Le script crée l'environnement virtuel s'il est manquant,
  installe Flask si nécessaire, puis lance `GameApp.py`.

1. Création de l'environnement (si nécessaire)
   1. `cd application`
   2. `python -m venv env`
   3. `env\Scripts\activate`
   4. `pip install flask`
2. Exécution de l'app
   1. `cd application`
   2. `env\Scripts\activate`
   3. `python GameApp.py`
