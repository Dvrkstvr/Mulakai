head -24 ~/sheetsage-spike/out/ellies/score.abc
grep -n "melody_only\|generate_abc\|abc_error" ~/sheetsage2/SheetSage2/infer.py | head
~/sheetsage2/.venv/bin/python -c "import pretty_midi,numpy,sys;print(sys.version)"
mkdir -p ~/sp8; for d in ellies purple eventide; do rm -rf ~/sp8/$d; mkdir -p ~/sp8/$d; cp -r ~/sheetsage-spike/out/$d/notation ~/sp8/$d/; cp ~/sheetsage-spike/out/$d/score.abc ~/sp8/$d/orig.abc; done
cp -r ~/sp4/ss/B_d ~/sp8/B_d_full; mkdir -p ~/sp8/B_d; cp -r ~/sp4/ss/B_d/notation ~/sp8/B_d/; cp ~/sp4/ss/B_d/score.abc ~/sp8/B_d/orig.abc; rm -rf ~/sp8/B_d_full
du -sk ~/sp8/*/notation
