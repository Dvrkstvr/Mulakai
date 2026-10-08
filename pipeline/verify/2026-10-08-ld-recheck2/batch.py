# -*- coding: utf-8 -*-
import run, drive
B="ein langsamer Popsong über Abschied am Bahnhof"
R="ein fröhlicher Rocksong über eine Sommerreise ans Meer"
chats=[("c1",R,"mach es etwas schneller"),("c2",B,"mach es etwas schneller"),
("c3","eine ruhige Ballade über den ersten Schnee im Winter","mach es etwas schneller"),
("c4",B,"mach es etwas schneller"),("c5","ein trauriges Lied über den Regen im Herbst","mach es etwas schneller"),
("c6","ein sehnsüchtiges Lied über Heimweh nach dem Meer","mach es etwas schneller"),
("c7",B,"etwas schneller bitte, Text unverändert"),("c8",R,"etwas schneller bitte, Text unverändert"),
("c9",B,"schreib den Refrain neu"),("c10","an upbeat indie road trip song","make it faster")]
for n,f,u in chats:
    try:
        drive.req('POST',drive.API+'/chat/draft/reset',{})
        run.run_turn(n+'_first',f); run.run_turn(n+'_fu',u)
    except Exception as e: print('ERR',n,e,flush=True)
print('ALLDONE',flush=True)
