# STM32 — tam teşekküllü Binding ve mantıksal operatörler (C araştırması)

| Alan | Değer |
|---|---|
| Kapsam | Araştırma. Firmware C ve Designer TS **yazılmadı**. |
| İlişki | `stm32_binding_motoru_20260819.md` = MCU Binding tablosu (düz AND/OR). **Bu belge** = iç içe mantık, daha çok parametre, C’de nasıl hesaplanır. |
| Baseline | MyApplication_6 `sahne_degerlendir` AND-satır / OR-çok-satır; Designer `conditionMode` all\|any (`runtime.ts:91-101`) |
| Yer | Aynı kopya: `Template_Designer/docs/stm32-contract/` |

---

## 1. Soru

Designer’da Binding şöyle olsa:

```text
(fire == true AND floor == 5)
OR
(overload == true AND NOT door == open)
AND THEN  hide(video)  priority 10
```

ve onlarca runtime parametre (fire, floor, door, travel, lighting, …) olsa, **STM32 C bunu her UI karesinde nasıl çözer?** Heap, özyineleme, JSON parser olmadan.

Cevap üç katmanlıdır:

1. **Anlam** (Designer = MCU, aynı Boolean)
2. **Derleme** (PC ifadeyi MCU’nun yutacağı düz forma çevirir)
3. **C değerlendirici** (sabit tampon, yığın makinesi veya DNF)

MCU’da `eval("fire && floor==5")` string **yok**.

---

## 2. Bugün ne var (kanıt)

**Designer** (`runtime.ts`): koşul listesi + tek `all` (AND) veya `any` (OR). İç içe `(A AND B) OR (C AND NOT D)` **modelde yok**. Operatörler: equals, not-equals, greater-than, less-than, contains. `negated` koşul NOT’u.

**STM32 sahne** (`sahne_degerlendir`, `sahne_motoru.c:52-58`): bir `sahne` satırında jetonlar AND; aynı ada ikinci satır OR. Bu **DNF** (veya-of-and). Binding henüz yok.

Tam teşekküllü Binding = sahnenin DNF’ini Binding’e taşımak + karşılaştırma operatörlerini state snapshot’ına bağlamak + isteğe **postfix** ile gerçek parantez.

---

## 3. İfade türleri

Kullanıcı “daha fazla parametre ve mantıksal operatör” deyince C’de üç sınıf var.

### 3.1 Atom (yaprak)

```text
PARAM  OP  LITERAL
fire   eq  1
floor  gt  5
door   ne  2
```

Parametre = canonical snapshot alanı (`runtime_state_t`), literal = int16 (V1). String `contains` MCU’da pahalı; V1 atom **yalnız skaler**.

### 3.2 Bağlaç

`AND` `OR` `NOT` (isteğe `XOR`). De Morgan: `NOT (A AND B)` = `(NOT A) OR (NOT B)`.

### 3.3 Tam ağaç vs düz DNF

| Biçim | Örnek | MCU maliyeti |
|---|---|---|
| Düz AND/OR listesi | Designer bugün | Zaten var |
| **DNF** | `(A∧B) ∨ (C∧¬D)` = iki Binding satırı aynı eylem | Parser büyüm ez; `sahne` ile aynı |
| **CNF** | AND-of-OR | Gizle kurallarına uygun, show’a değil |
| **Postfix bytecode** | `fire 1 EQ floor 5 EQ AND` | Parantez tam; yığın 8 | 
| AST işaretçi | malloc node | **Yasak** (tema yükü + kare) |

Önerilen C çözümü: **Designer DNF’e indirger; MCU AND-satır / OR-çok-kayıt**. Parantez kaçarsa (XOR, paylaşılan alt ifade) **postfix yığın** ikinci evre.

---

## 4. DNF — C’nin doğal modeli (birinci çözüm)

Boolean her ifade (XOR hariç) DNF’e açılır:

```text
(fire AND floor==5) OR (overload AND NOT door_open)
```

iki Binding kaydı, **aynı widget, aynı eylem, aynı öncelik**, farklı AND grupları:

```text
binding videoWidget1 : oncelik=10 eylem=pause all st=fire eq=1 st=floor eq=5
binding videoWidget1 : oncelik=10 eylem=pause all st=overload eq=1 st=door ne=2
```

Değerlendirme (C, sözde):

```c
/* Aynı (widget, eylem, oncelik) grubu = OR.
 * Grup içi kosul[] = AND. */
bool bag_esles(const tema_bag_t* b, const runtime_state_t* s)
{
    bool ok = (b->all != 0);          /* all=1 AND, all=0 OR tek kayıtta */
    for (int i = 0; i < b->kosul_n; i++) {
        bool a = atom_dogru(&b->kosul[i], s);
        if (b->kosul[i].not) a = !a;
        if (b->all) { if (!a) return false; }
        else        { if (a)  return true;  }
    }
    return b->all ? true : false;     /* AND: hepsi geçti; OR: hiçbiri */
}
```

Aynı widget’a birden fazla kayıt OR sayılır **yalnız** eylem+öncelik aynıysa. Farklı öncelik: ayrı Binding, kazanan max priority (`stm32_binding_motoru` §6).

**Patlama riski:** `(A∨B∨C) AND (D∨E∨F)` → 9 AND-terimi. Designer Validate: DNF terim sayısı ≤ `BAG_MAX` (32) ve terim başı atom ≤ 4 (`BAG_KOSUL_MAX`, sahne ile aynı). Aşım: yayın kes, MCU’da sessiz kırpma yok.

STM32 ekstra parser mantığı neredeyse **sıfır**: motor belgesindeki düz tablo yeterli; “tam mantık” **Designer derlemesinde**.

XOR DNF’de 4 terime şişer. Nadir ise postfix (bölüm 5).

---

## 5. Postfix yığın — parantez ve XOR (ikinci çözüm)

DNF şişerse ifade **ters Polonya** dizisi olur. Heap yok, özyineleme yok.

```c
enum {
    OP_PUSH_STATE = 0,  /* arg = ST_FIRE … */
    OP_PUSH_I16,        /* arg = literal */
    OP_EQ, OP_NE, OP_LT, OP_GT, OP_LE, OP_GE,
    OP_AND, OP_OR, OP_XOR, OP_NOT,
    OP_END
};

typedef struct {
    uint8_t op;
    int16_t arg;        /* state id veya literal */
} bag_op_t;

#define BAG_OPS_MAX  24   /* ifade başına */
#define BAG_STK      8
```

Örnek: `(fire==1 AND floor==5) OR overload`

```text
ST_FIRE,1,EQ,  ST_FLOOR,5,EQ,  AND,  ST_OVERLOAD,1,EQ,  OR,  END
```

C değerlendirici:

```c
static bool bag_eval_ops(const bag_op_t* p, int n, const runtime_state_t* s)
{
    int16_t stk[BAG_STK];
    int sp = 0;
    for (int i = 0; i < n; i++) {
        uint8_t op = p[i].op;
        if (op == OP_PUSH_STATE) {
            if (sp >= BAG_STK) return false;
            stk[sp++] = runtime_oku(s, (uint8_t)p[i].arg);
        } else if (op == OP_PUSH_I16) {
            if (sp >= BAG_STK) return false;
            stk[sp++] = p[i].arg;
        } else if (op == OP_NOT) {
            if (sp < 1) return false;
            stk[sp-1] = !stk[sp-1];
        } else {
            if (sp < 2) return false;
            int16_t b = stk[--sp], a = stk[--sp];
            int16_t r = 0;
            switch (op) {
            case OP_EQ:  r = (a == b); break;
            case OP_NE:  r = (a != b); break;
            case OP_LT:  r = (a <  b); break;
            case OP_GT:  r = (a >  b); break;
            case OP_LE:  r = (a <= b); break;
            case OP_GE:  r = (a >= b); break;
            case OP_AND: r = (a && b); break;
            case OP_OR:  r = (a || b); break;
            case OP_XOR: r = (a != 0) ^ (b != 0); break;
            default:     return false;   /* bilinmeyen op: eşleşme yok, çökme yok */
            }
            stk[sp++] = r;
        }
    }
    return (sp == 1) && (stk[0] != 0);
}
```

Kurallar:

- Yığın taşması / eksik operand / `OP_END`’de `sp!=1` → **eşleşmez** (fail-closed Binding, sahne varsayılanı değil).
- ISR’da çağrılmaz.
- `n > BAG_OPS_MAX` yüklemede `bag_dusen`, kayıt yok.
- `contains` / Unicode: bu VM’de yok; Designer keser veya ayrı `OP_STREQ` + kısa ASCII tampon (**PRODUCT DECISION**).

Bellek: 32 Binding × 24 op × 4 B ≈ **3 KB**. DNF-only ~1 KB. İkisi birden tutulmaz: kayıt ya `kosul[]` ya `ops[]` (`tur` baytı).

---

## 6. Atom operatörleri (parametre karşılaştırması)

`runtime_oku(state_id)` int16 döner. Enum kapı/seyir küçük tamsayı.

| Op | C | Designer | MCU V1 |
|---|---|---|---|
| eq / ne | `==` `!=` | equals, not-equals | evet |
| lt / gt / le / ge | `< > <= >=` | gt/lt var; le/ge **eklenmeli** veya `NOT gt` | evet skaler |
| not (atom) | `!` | `negated` | evet |
| contains | `strstr` | var | **hayır** (string yok) |
| in (liste) | döngü | yok | 4’lük literal tablo veya DNF `eq` OR |
| between | `lo<=x && x<=le` | yok | iki atom AND |

**Daha fazla parametre:** snapshot büyür, VM değişmez.

```c
/* örnek genişleme — Binding VM aynı kalır */
int16_t runtime_oku(const runtime_state_t* s, uint8_t id)
{
    switch (id) {
    case ST_FIRE:      return s->fire;
    case ST_OVERLOAD:  return s->overload;
    case ST_SERVICE:   return s->service_out;
    case ST_DOOR:      return s->door;
    case ST_TRAVEL:    return s->travel;
    case ST_FLOOR:     return s->floor;
    case ST_LANG:      return s->lang;       /* setting */
    case ST_SOUND:     return s->sound_on;
    default:           return 0;             /* bilinmeyen id = 0, atom false (eq 1) */
    }
}
```

Yeni ARKEL biti = `arkel_feed` içinde yeni alan + enum. Binding satırı `st=lighting eq=1`. Designer profil registry. **C VM’e case eklenir; ifade motoruna değil.**

Bilinmeyen `st=` yüklemede: atom hiç true olmaz (eq) / NOT ile true olabilir — **UNKNOWN id fail-closed** önerilir: `runtime_oku` sentinel `INT16_MIN`, `eq` false.

---

## 7. Uçtan uca gerçekleşme (örnek)

Designer Binding:

```text
widget: videoWidget1
priority: 10
action: pause
expr: (fire==true AND floor>=5) OR overload==true
```

**PC derleme (DNF):**

```text
T1: fire eq 1 AND floor ge 5
T2: overload eq 1
```

**Disk (`tema.cfg`), STM32 Binding parser sonrası:**

```text
binding videoWidget1 : oncelik=10 eylem=pause all st=fire eq=1 st=floor ge=5
binding videoWidget1 : oncelik=10 eylem=pause all st=overload eq=1
```

**Her kare (`havuzGorunurlukTazele`):**

1. `runtime_state_t` zaten `arkel_feed` ile dolu (`seq` değiştiyse).
2. Widget üye mi (`sahne=`)? Hayır → gizle, Binding yok.
3. Evet → `oncelik=10` pause grubu: T1 veya T2?
4. T1: `s->fire==1 && s->floor>=5`
5. T2: `s->overload==1`
6. OR true → video `pause` (okuyucu açıksa; kapalıysa görünür yapma).
7. Hiç T yok → üyelik görünürlüğü.

**Postfix alternatifi aynı anlam:**

```text
binding videoWidget1 : oncelik=10 eylem=pause ops= fire 1 EQ floor 5 GE AND overload 1 EQ OR
```

C `bag_eval_ops`. Semantik Designer Preview ile birebir olmalı (aynı DNF veya aynı bytecode üretici test fixture).

---

## 8. Öncelik ve birden fazla ifade

Mantık **eşleşme** üretir. **Hangi eylem** ayrı:

```text
eşleşen Binding’ler
  → oncelik 15…0
  → eşitlikte sira (dosya sırası)
  → tek eylem uygulanır
```

İki ifade OR (aynı eylem) vs iki Binding çatışması (hide vs show) karışmaz: önce eşleşme, sonra priority. DNF terimleri **aynı Binding kimliği** sayılır (aynı oncelik+eylem+widget).

---

## 9. Yükleme (C parser)

`sahne_yukle` içinde `binding ` dalı. İki biçim (bir kayıtta biri):

- **Düz:** `st= fire eq=1` tekrar AND (`all`) veya `any`
- **Ops:** `ops=` sonrası token listesi; bilinmeyen token → kayıt düş (`bag_dusen`), çökme yok

Eski ELF bu satır türünü atlar (yangın fail-open **olmaz**).

Satır 160 karakter (`tema.cfg` `line[160]`). Uzun postfix **sığmaz** → Designer çok satıra böler (`ops+` devam) veya DNF tercih edilir. **Öneri: DNF birinci; ops yalnız XOR/derin parantez ve satır ≤160.**

---

## 10. Ne C’de, ne Designer’da

| İş | Nerede | Neden |
|---|---|---|
| `(A∨B)∧(C∨D)` açılımı | Designer | patlama kontrolü, 160 char |
| XOR / derin NOT | Designer → postfix **veya** De Morgan DNF | MCU yığın veya terim |
| `st=fire` adı → id | Yükleme tablosu | küçük switch |
| ARKEL → snapshot | `arkel_feed` | bit UI’da yok |
| AND/OR/NOT/karşılaştırma | C `bag_esles` / `bag_eval_ops` | her kare |
| `contains` / Unicode floor | Designer kes **veya** sonra | MCU string yok |
| 5 ses kanalı Binding | ürün kararı | 2 otobüs |

---

## 11. Sınırlar (önerilen, ölçülmeden kilit değil)

| Sınır | Değer | Gerekçe |
|---|---|---|
| `BAG_MAX` | 32 | ~1–3 KB |
| AND atom / terim | 4 | `SAHNE_KOSUL_MAX` ile aynı |
| Postfix op / Binding | 24 | satır 160 |
| Yığın | 8 | iç içe AND/OR |
| State id | uint8, ≤32 alan | snapshot |
| Literal | int16 | kat -99..999 sığar |

Aşım: Designer Validate. MCU `*_dusen`, sessiz kırpma yok.

---

## 12. Önerilen evreler (C)

| Evre | C ne kazanır | Mantık gücü |
|---|---|---|
| 0 | `runtime_state_t` | Binding yok |
| 1 | Düz `kosul[]` AND/OR + DNF çok kayıt | Tam Boolean (XOR hariç) **Designer açılımı ile** |
| 2 | `ge/le` atom | `floor>=5` tek atom |
| 3 | Postfix VM | XOR, derin parantez, satır sığarsa |
| 4 | `IN` / string | ürün + bellek |

Evre 1, “tam teşekküllü AND/OR/NOT” ihtiyacının çoğunu **C’yi şişirmeden** karşılar. Evre 3 ancak derleyici DNF’i 32 terime sığdıramazsa.

---

## 13. Test (C motoru)

- Fixture: snapshot + bytecode/DNF → bool; PC `runtime.ts` ile aynı vektör (golden JSON).
- `(A AND B) OR C` iki kayıt vs bir ops dizisi — aynı sonuç.
- Bilinmeyen op → false, reset yok.
- Yığın 8 taşması → false.
- Binding’siz kart = `havuzGorunurlukTazele` A/B.
- Eski ELF + `binding` satırı: sahne motoru bozulmaz.

---

## 14. Sonuç

STM32’de tam mantık **eval string değil**.

1. Parametreler = `runtime_state_t` (ARKEL decode).
2. Mantık = tercihen **DNF** (C zaten AND ∧ OR çok-kayıt).
3. Yetmezse **postfix yığın** (AND OR XOR NOT EQ …), 8 derin, 24 op.
4. Öncelik 0–15 eylem seçimi DNF’den ayrı.
5. JSON, malloc, özyinelemeli AST **yok**.

Kod yok; sonraki uygulama evre 0–1 (`stm32_binding_motoru` + bu DNF kuralı).
