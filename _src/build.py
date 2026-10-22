import json,glob,sys,collections,os
root=os.path.dirname(os.path.abspath(__file__))
out={}
for lv,pat in (("b","b"),("a","a")):
    qs=[]
    for f in sorted(glob.glob(f"{root}/orig_{pat}.json"))+sorted(glob.glob(f"{root}/{pat}[0-9]*.json")):
        try: data=json.load(open(f))
        except Exception as e: sys.exit(f"{f}: {e}")
        for i,q in enumerate(data):
            assert len(q)==7 and q[0] in (1,2,3) and all(isinstance(x,str) and x.strip() for x in q[1:]), (f,i,q)
            assert len(set(q[2:6]))==4,(f,i,q)
            qs.append(q)
    seen=collections.Counter(q[1] for q in qs)
    d=[k for k,v in seen.items() if v>1]
    if d: print("DUP",lv,d)
    print(lv,len(qs),collections.Counter(q[0] for q in qs))
    out[lv]=qs
if "--write" in sys.argv:
    with open(os.path.join(root,"..","questions.js"),"w") as fp:
        fp.write("// [難度1-3, 問題, 正解, 誤答1, 誤答2, 誤答3, 解説]\nwindow.QUESTIONS=")
        json.dump(out,fp,ensure_ascii=False,separators=(",",":"))
        fp.write(";\n")
