# Free-to-play prediction game with real prizes — Georgian law analysis

> **This is research for a legal-risk assessment, not legal advice.** It must be confirmed by a Georgian gaming/regulatory lawyer before launch.

Researched 2026-08-24 against primary sources (matsne.gov.ge consolidated texts, rs.ge). Georgian gambling law was substantially rewritten in Dec 2021 (in force 2022), amended again 09.02.2023 (№2584) and 25.06.2026 (№1822). Data protection supervision changed hands in Nov 2025. Amendment dates are noted per source.

---

## Bottom line

1. **There is no "no purchase necessary" carve-out in Georgian law.** Free entry does not take you *out* of the statute — it is the *defining and mandatory* condition of a specific permitted category, **წამახალისებელი გათამაშება** ("promotional draw"). Art. 3(o.d) of the Lotteries Law says the ticket *is issued free of charge* and *"it is inadmissible to set a fee in any form for participation"*. Charging destroys eligibility for the free category; it does not exempt you from the law.

2. **A promotional draw needs a permit from the Revenue Service, and it is expensive**: **15,000 GEL** permit fee (Permit Fees Law, Art. 7(10)(a)), valid **1 year** (Lotteries Law Art. 11(2¹)(b)), plus a gaming-business fee of **10% of the prize fund of each stage, paid before the stage starts** (Gaming Business Fee Law Arts. 4(c), 5(d), 6(1)–(2)). Decision in **20 days**, tacit approval if the Revenue Service misses it (Licences & Permits Law Art. 26(10)).

3. **But TFC's design as described does not cleanly fit the promotional-draw box either.** A promotional draw requires the win to fall on a *ticket* **by chance** and "not be specially arranged". TFC's winners are the top of a *skill/judgment leaderboard*. So the product currently sits in a genuine statutory gap — not a game of chance, not a lottery, arguably not a totalizator, arguably not a promotional draw. **This is the single biggest unresolved question and needs Georgian counsel.**

4. **The dangerous neighbour is ტოტალიზატორი (totalizator)** — Art. 3(o.c) defines it as a game run by players *placing bets on the prediction of the course of a competition or the result of an event*, where the win depends on **the size of the bet and the result**. That is TFC's mechanic verbatim, minus real money. The statute never defines **ფსონი** ("bet"), so whether a free virtual coin can be a "bet" is unsettled. If a regulator says yes, the required permit is 30,000–300,000 GEL/yr (retail) or 100,000 GEL/yr (online).

5. **Skill does not rescue it automatically.** Art. 4 excludes games with **no element of chance at all**, testing "special knowledge, intellect, dexterity, adroitness or other special ability". That is stricter than a US-style "predominance of skill" test. Predicting a fight outcome arguably imports chance.

6. **Age: the statute imposes no minimum age on promotional draws** — the 25/18 gambling age and the prohibited/dependent-persons registers are all expressly carved out with "(გარდა წამახალისებელი გათამაშებისა)" (Art. 32(1), (1¹)). **Nevertheless implement a hard 18+ gate** for data-protection, tax-withholding and reputational reasons. Do not let under-18s hold coins or win prizes.

7. **Advertising is fine.** The 2022 gambling-ad ban (Advertising Law Art. 8³) catches promotional draws **only if the permit holder is a gambling/totalizator/loto/bingo organizer** (Art. 8³(4)). TFC is not. Promote freely — but never use betting vocabulary ("ფსონი", "კოეფიციენტი", "ბუკმეიკერი") and never co-brand with a licensed bookmaker.

8. **Prizes are taxable and TFC must withhold.** Tax Code Art. 154(1)(e) makes a promotional-draw organiser a tax agent when paying a win to an individual; the rate is 20% (Art. 81(1)). The 1,000 GEL exemption in Art. 82(1)(ღ) applies **only to lotteries** — not to promotional draws. Budget for gross-up on merch/tickets.

---

## 1. Classification

### 1.1 The statute

**Law of Georgia on Arranging Lotteries, Games of Chance and Other Prize Games** (ლატარიების, აზარტული და მომგებიანი თამაშობების მოწყობის შესახებ), Law No. 1180 of 25 March 2005, published სსმ 15, 19.04.2005. Consolidated version current; **last amended by Law №1822 of 25 June 2026** (published 03.07.2026). [Primary — matsne 30988](https://matsne.gov.ge/ka/document/view/30988)

Art. 5(1): *"On the territory of Georgia, the holding of all types of games of chance and/or prize games, the organisation of games of chance and/or prize games in systemic-electronic form, and the supply of games of chance and/or prize games requires a permit in accordance with the Law of Georgia on Licences and Permits. Holding … without a permit, as well as failure to comply with permit conditions, is deemed a breach of the law and entails liability."*

### 1.2 აზარტული თამაშობა — "game of chance" (Art. 3(a))

> „აზარტული თამაშობები – თამაშობები, რომელთა შედეგი მთლიანად ან ნაწილობრივ შემთხვევითობაზეა დამოკიდებული. ეს თამაშობები ტარდება ბანქოს, კამათლის (გარდა ნარდისა), სათამაშო ბორბლის (რულეტის), სათამაშო აპარატის, სამორინის მაგიდის, კლუბის მაგიდის ან/და სხვა სათამაშო ინვენტარის მეშვეობით და მათში მონაწილეობა **ფულადი მოგების** შესაძლებლობას იძლევა.“

*"Games of chance — games whose outcome depends wholly or partly on chance. These games are conducted by means of cards, dice (other than backgammon), a gaming wheel (roulette), a gaming machine, a casino table, a club table and/or other gaming inventory, and participation in them affords the possibility of a **monetary win**."*

**Not TFC.** Three cumulative elements fail: (i) no cards/dice/roulette/machine/table/"other gaming inventory"; (ii) no possibility of a **monetary** win (merch and tickets are not ფულადი მოგება); (iii) the same subparagraph confines the organisation of games of chance to casinos, slot halls, gambling clubs, or the enumerated systemic-electronic permit forms.

### 1.3 ლატარია — "lottery" (Art. 3(th))

> „ლატარია – ნებაყოფლობითი ჯგუფური ან მასობრივი თამაშობა, რომლის დროსაც ლატარიის ორგანიზატორი საჯაროდ გამოქვეყნებული, დადგენილი წესისა და პირობების დაცვით ათამაშებს საპრიზო ფონდს. მოგების დამთხვევა ლატარიის რომელიმე ბილეთზე დამოკიდებული არ არის ლატარიის ორგანიზატორის ან სხვა სუბიექტის ნება-სურვილსა და მოქმედებაზე, წარმოადგენს შემთხვევითობას და არ შეიძლება იყოს სპეციალურად მოწყობილი.“

*"Lottery — a voluntary group or mass game in which the lottery organiser plays out a prize fund in compliance with publicly published, established rules and conditions. The coincidence of a win on any lottery ticket does not depend on the will or action of the lottery organiser or any other subject, constitutes chance, and cannot be specially arranged."*

**Not available to TFC.** Lottery in Georgia is a **state-tendered exclusive monopoly**: Art. 6(1) — the organiser is the winner of a Ministry of Finance tender; Art. 6(5) — the exclusive right runs for 10 years. Unauthorised organisation of a lottery is fined **50,000 GEL**, and **150,000 GEL** for each subsequent instance (Art. 37²(2)–(3)), imposed by the Revenue Service (Art. 37³(1)).

### 1.4 მომგებიანი თამაშობა — "prize game" (Art. 3(o))

Art. 3(o) is an exhaustive list of four subtypes:

| Subparagraph | Term | Georgian | Relevance |
|---|---|---|---|
| o.a | Loto | ლოტო | No |
| o.b | Bingo | ბინგო | No |
| **o.c** | **Totalizator** | **ტოტალიზატორი** | **Structurally identical mechanic** |
| **o.d** | **Promotional draw** | **წამახალისებელი გათამაშება** | **The free-entry category** |

#### ტოტალიზატორი (Art. 3(o.c), as amended)

> „ტოტალიზატორი – თამაშობა, რომელიც იმართება მოთამაშეების მიერ შეჯიბრების მიმდინარეობის, თამაშობის, რაიმე მოვლენის/მოვლენების შედეგის პროგნოზზე **ფსონების დადებით**, ხოლო მოგება დამოკიდებულია **ფსონის მოცულობასა და შედეგზე**. აკრძალულია ტოტალიზატორის მოწყობა იმ შემთხვევებში, როდესაც შედეგი შესაძლოა წინასწარ იყოს ცნობილი ერთ-ერთი ან ორივე მხარისთვის. ტოტალიზატორი იმართება სპეციალურად მოწყობილ შენობა-ნაგებობაში … ან/და … სისტემურ-ელექტრონული ფორმით“

*"Totalizator — a game organised by players **placing bets** on a forecast of the course of a competition, of a game, or of the result of an event/events, where the win depends on **the volume of the bet and the result**. Organising a totalizator is prohibited where the result may be known in advance to one or both parties. A totalizator is held in a specially arranged building or part of a building and/or in systemic-electronic form."*

This is **the exact shape of TFC's product**: stake on winner / method / round, payout = stake × multiplier, chained accumulators. The **only** distinguishing feature is that the stake is a free virtual coin rather than money.

**Critical gap: the Law never defines ფსონი ("bet"/"stake").** I searched the full consolidated text — there is no definition. So whether a valueless, non-purchasable, non-transferable virtual coin can be a "ფსონი" is genuinely open. Two readings:

- *Restrictive (favours TFC):* a bet presupposes something of value risked; a coin that costs nothing, cannot be bought and cannot be redeemed is not a bet. Also, the totalizator subparagraph mandates a physical venue or a systemic-electronic permit — infrastructure Georgian law ties to real-money wagering. **This is inference, not a holding.**
- *Expansive (favours the regulator):* the statute keys on the *mechanic* (forecast + stake + payout proportional to stake and result), not on the medium of the stake. Because the leaderboard converts coins into real prizes, the coin has economic value at the end of the chain.

If the expansive reading wins, TFC is running an unpermitted totalizator. Permit cost would be **30,000–300,000 GEL/yr** for retail totalizator, or **100,000 GEL/yr** for systemic-electronic totalizator organisation (Permit Fees Law Art. 7(10)(d), (l)), plus a 10,000 GEL prize-fund security (Lotteries Law Art. 12(1)(d.a)) and quarterly gaming-business fees.

#### წამახალისებელი გათამაშება (Art. 3(o.d)) — the pivotal provision

> „წამახალისებელი გათამაშება – თამაშობა, რომლის დროსაც ორგანიზატორი საჯაროდ გამოქვეყნებული, დადგენილი წესისა და პირობების დაცვით ათამაშებს საპრიზო ფონდს. მოგების დამთხვევა რომელიმე ბილეთზე დამოკიდებული არ არის ორგანიზატორის ან სხვა სუბიექტის ნება-სურვილსა და ქმედებაზე, **შემთხვევითობაა** და არ შეიძლება იყოს სპეციალურად მოწყობილი. წამახალისებელი გათამაშება ტარდება **კონკრეტული სახის პროდუქციის (მომსახურების) სწრაფად და ეფექტიანად რეალიზების მიზნით** … **წამახალისებელი გათამაშების ბილეთი გაიცემა უფასოდ.** წამახალისებელი გათამაშების მოწყობის ნებართვა გაიცემა კონკრეტული სახის პროდუქციის (მომსახურების) მწარმოებელზე ან მის წარმომადგენელზე … **დაუშვებელია წამახალისებელ გათამაშებაში მონაწილეობისთვის ნებისმიერი ფორმით საფასურის დაწესება;“**

*"Promotional draw — a game in which the organiser plays out a prize fund in compliance with publicly published, established rules and conditions. The coincidence of a win on any ticket does not depend on the will or action of the organiser or any other subject, **is chance**, and cannot be specially arranged. A promotional draw is conducted **for the purpose of the rapid and effective realisation (sale) of a specific type of product (service)** … **The ticket of a promotional draw is issued free of charge.** The permit to arrange a promotional draw is issued to the producer of the specific type of product (service) or to its representative … **It is inadmissible to set a fee in any form for participation in a promotional draw.**"*

**This answers the consideration question directly.** Georgian law recognises free entry — but as an *entry condition to a licensed category*, not as an exemption. The mirror image of US sweepstakes law: in the US, removing consideration removes the activity from gambling regulation; in Georgia, removing consideration is what qualifies you for the promotional-prize-game **permit**, which is mandatory (Art. 11(1)(a)).

**But TFC's mechanic fails the chance element of this definition.** The prize must fall on a *ticket* by *chance*, "not specially arranged". A leaderboard of the ten best forecasters is the opposite: the outcome is deliberately determined by participant performance. Strictly read, TFC's product is not a წამახალისებელი გათამაშება.

Helpfully, **"ticket" is defined very broadly** — Art. 3(i): *"a card prepared for sale or distribution, a document confirming participation in the game, an item, **a personal identification code (number)** and/or another carrier of information which corresponds to the law and to the regulation of the specific lottery or prize game and, in the event of a win, confirms the fact of the win."* So a digital account entry / coin ID can be a "ticket". The obstacle is the chance element, not the medium.

### 1.5 Where that leaves the product

| Box | Fits? | Why |
|---|---|---|
| Game of chance (Art. 3(a)) | **No** | No gaming devices; no monetary win |
| Lottery (Art. 3(th), Art. 6) | **No** | State tender monopoly; not open to TFC |
| Totalizator (Art. 3(o.c)) | **Unsettled** | Mechanic matches exactly; turns on whether a free coin is a "ფსონი" |
| Promotional draw (Art. 3(o.d)) | **Partly** | Free entry and promotional purpose fit; the "win by chance on a ticket" element does not |
| Outside the Law (Art. 4) | **Unsettled** | Requires *no* element of chance — see §2 |
| Civil Code contest (Arts. 755–762) | **Plausible fallback** | Public promise of reward / competition; no permit |

**The Civil Code fallback.** Arts. 755–762 (ჯილდოს საჯაროდ დაპირება. კონკურსი — "public promise of reward. Competition"), [Primary — matsne 31702](https://matsne.gov.ge/ka/document/view/31702):

- Art. 755: *"A person who by public promise establishes a reward for the performance of a certain action, in particular for the achievement of one or another result, is obliged to pay the reward to the person who performed the action."*
- Art. 758(2): a competition announcement is valid **only if it specifies a definite period** for performing the work.
- Art. 759: **changes to competition conditions that harm participants are inadmissible.**
- Art. 760: the person named in the announcement decides who satisfied the conditions / which entry is best.
- Art. 761: several winners → the reward rules apply pro rata.

Counterpoint, and it is a real one — Art. 951(1): *"A game or a wager does not give rise to a right of claim."* Art. 952: *"A lottery contract or similar games give rise to an obligation only if they (the draw, casting of lots, ballot) are permitted by the state."* So if the product is characterised as a *game* rather than a *competition*, the private-law prize promise is unenforceable and the public-law permit question bites.

**Inference (flagged as such):** the further TFC's design moves from "stake-and-payout on chance-laden events" toward "publicly announced skill competition, fixed period, transparent scoring, best forecaster wins", the more securely it lands in Arts. 755–762 and outside the Lotteries Law. The current design — coins, stakes, burn-on-loss, compounding multipliers — points the other way.

---

## 2. Does skill vs chance matter?

**Yes, but the Georgian test is much stricter than a US "predominance of skill" test.**

**Art. 4** (as amended by Law №2584 of 09.02.2023, published 24.02.2023):

> „ლატარიას, აზარტულ ან/და მომგებიან თამაშობებს, სისტემურ-ელექტრონული ფორმით ორგანიზებულ აზარტულ ან/და მომგებიან თამაშობებს **არ მიეკუთვნება** თამაშობები, რომლებიც ტარდება მანქანების, აპარატების, მოწყობილობების, ინტერნეტის, ტელეფონის, სპეციალურად მოწყობილი ელექტრონული საშუალებებისა და სხვა საშუალებების გამოყენებით და **რომლებშიც გათვალისწინებული არ არის შემთხვევითობის ელემენტი**. მათი მიზანია მონაწილეთა განსაკუთრებული ცოდნის, ინტელექტის, სიმარჯვის, მოხერხებულობის ან სხვა განსაკუთრებული უნარის ტესტირება ან დემონსტრირება.“

*"Lotteries, games of chance and/or prize games, and games of chance and/or prize games organised in systemic-electronic form, **do not include** games conducted using machines, apparatus, devices, the internet, the telephone, specially arranged electronic means and other means **in which an element of chance is not provided for**. Their purpose is the testing or demonstration of the participants' special knowledge, intellect, dexterity, adroitness or other special ability."*

Two readings, both defensible:

- *Pro-TFC:* "element of chance" refers to the **game's own mechanics** — no RNG, no shuffle, no draw. TFC's engine is deterministic: it scores forecasts against published results. The purpose is precisely to test "special knowledge" of MMA. On this reading Art. 4 applies and the product is outside the Lotteries Law entirely.
- *Pro-regulator:* the outcome the participant is forecasting — who wins an MMA fight, by what method, in which round — is inherently uncertain and outside anyone's control. A submission in round 2 versus a decision is materially a matter of chance. And Art. 3(o.c) shows the legislature already classified *forecasting event outcomes* as regulated activity rather than skill.

The Art. 4 wording ("**არ არის გათვალისწინებული შემთხვევითობის ელემენტი**" — "an element of chance is not provided for") is absolute. It does not say "predominantly" or "primarily". **A regulator applying it literally to fight-outcome forecasting would likely find the chance element present.** This is the second unresolved question for counsel.

Note the design implication: the *round* and *method* markets are the most chance-laden. A "pick the winner only" product is materially easier to defend as skill.

---

## 3. Permit, fee and timeline (if run as a promotional draw)

### 3.1 Permit is mandatory

- **Art. 11(1)(a):** the arranging of a promotional draw (წამახალისებელი გათამაშების მოწყობა) is subject to a permit.
- **Art. 11(2):** the permit is issued **only to an entrepreneur registered in Georgia**.
- **Art. 11(2¹)(b):** promotional-draw permit term — **1 year** (contrast: 5 years for most other permits).
- **Art. 11(3):** a lottery and a promotional draw may be held in **systemic-electronic form** only in compliance with the requirements of this Law. *(Note: unlike casino/slots/totalizator, there is **no separate "systemic-electronic organisation" permit type** for promotional draws in Art. 11(1). How an online-only promotional draw is permitted in practice needs confirmation with the Revenue Service.)*
- **Art. 11(2³):** the tax-debt bar on permits expressly **does not** apply to promotional-draw permits.
- **Art. 11(2⁴):** the permit **may not be transferred** to another person.

### 3.2 Issuer and documents

The application goes to the **Revenue Service** (შემოსავლების სამსახური), an LEPL under the Ministry of Finance — Art. 12(1). Its departmental gaming-permit register is public at [rs.ge/GamblingBusiness](https://www.rs.ge/GamblingBusiness) (Primary).

Documents beyond the generic set in Licences & Permits Law Art. 25:

- **Art. 12(1)(a):** contract with the ticket printer, stating quantity and numbering — *expressly not required for games arranged in systemic-electronic form*.
- **Art. 12(1)(b):** the **regulation** (მოწყობის პირობები / რეგლამენტი), which must state:
  - (b.a) the period and place of the game;
  - (b.b) place, date and deadline for paying out wins. **Statutory default: wins must be paid within 30 calendar days of the draw, and no later than 6 days after presentation of the winning ticket.**
  - (b.c) the **claims (pretension) procedure and deadline — must not exceed 30 calendar days** from when the claim arises;
  - (b.d) the number and numbering of tickets;
  - (b.e) the **general rule of the game**; for a promotional draw, the submitted general rule (**"the reason and purpose of the game"** — თამაშობის მიზეზი და მიზანი) must conform to **criteria established by the Minister of Finance**;
  - (b.z) for a promotional draw: the **prize fund, the date and address of the draw, the list and quantity of prizes, the unit value, and the order of the draw**.
- **Art. 12(1)(c):** specimen ticket with anti-forgery marks, signed by the applicant.
- **Art. 12(1)(c¹):** if the permit is sought by a *representative* of the producer, the document proving authority.
- **Art. 12(1)(k), (l):** criminal-record certificates are **expressly waived** for promotional-draw applicants; proof of the origin of funds for the permit fee is required.

> **Gap I could not close:** I did not locate the Minister of Finance order setting the Art. 12(1)(b.e) criteria for the "reason and purpose" of a promotional draw. It may be recent (the Art. 12 amendment history runs to 2026). **Counsel must obtain it** — it may determine whether "promoting TFC events and merchandise" is an acceptable purpose.

### 3.3 Ongoing operational duties

- **Art. 13(4):** the regulation **may not be changed before a stage ends** (except ticket quantity/numbering); notify the Revenue Service no later than 1 day before any such change.
- **Art. 13(5):** **only one stage may run at a time** under a permit (Art. 13(4) second sentence / Art. 13(5) prohibition on two or more simultaneous stages).
- **Art. 13(5):** for **each new stage**, submit to the Revenue Service for consent: (a) the regulation; (b) specimen ticket (not needed for systemic-electronic form); (c) the ticket-printing contract (same exclusion).
- **Art. 16(1):** the organiser must ensure the **regulation is public and freely available to players**, and must **form a commission** that conducts the draw of the prize fund in accordance with the regulation.
- **Art. 16(2):** report the **progress and results of the draw to the Revenue Service within 2 days**.
- **Art. 29(1)(c), (e), (gh):** conduct the game and pay wins strictly per the submitted regulation; decide player claims within the regulation's stated deadline.
- **Art. 29(1)(f):** comply with the AML law and report to the Financial Monitoring Service. See §3.6.
- **Art. 36:** the Ministry of Finance is obliged to supervise compliance with **every clause** of the law and the regulation.
- **Art. 35(1):** promotional draws are **expressly exempt** from the ban on arranging games in children's, medical, educational, religious, library, museum and government premises.

### 3.4 Costs

| Item | Amount | Source |
|---|---|---|
| Permit fee, promotional draw | **15,000 GEL** | Law on Licence and Permit Fees, **Art. 7(10)(a)** — consolidated 25/06/2026 |
| Permit term | 1 year | Lotteries Law Art. 11(2¹)(b) |
| Gaming business fee | **10% of the prize fund of each stage**, payable **before the stage begins**, by purchasing a fee payment mark | Gaming Business Fee Law Arts. 4(c), 5(d), 6(1)–(2), 6(4)–(5) |

For comparison — same fee schedule, Art. 7(10): loto/bingo 15,000 GEL/yr each; totalizator 30,000–300,000 GEL/yr; systemic-electronic totalizator 100,000 GEL/yr; slot hall 50,000–1,000,000 GEL/yr; online casino 5,000,000 GEL/yr.

### 3.5 Timeline

Licences & Permits Law (Law No. 1775 of 24.06.2005), [Primary — matsne 26824](https://matsne.gov.ge/ka/document/view/26824):

- **Art. 26(1):** decided under **simplified administrative proceedings**.
- **Art. 26(10):** the issuer **must decide within 20 days** of the application. **If no decision is taken within 20 days, the permit is deemed granted** (tacit approval).
- **Art. 26(4)–(5):** extension beyond the statutory period is possible up to 3 months, but only if the applicant is notified **within 20 days**; further extension to 6 months requires a Government decision (Art. 26(6)–(8)).
- **Art. 25(4):** proof of payment of the permit fee must accompany the application.
- **Art. 25(15):** changes to registered data must be notified in writing within **7 days**.

**Practical planning assumption (inference):** budget 4–8 weeks from a complete filing, and treat the Minister of Finance "reason and purpose" criteria and the online-form question as the likely sources of delay.

### 3.6 Penalties for getting it wrong

- **Administrative Offences Code, Art. 176⁴** ([Primary — matsne 28216](https://matsne.gov.ge/ka/document/view/28216)), added by Law №6491 of 25.06.2020:
  > *"Arranging a promotional draw without the relevant permit … entails a fine on the arranger of **20,000 GEL and 10% of the prize fund drawn / to be drawn**."* Repeat offence: **40,000 GEL + 10%**.
  > **Note: "If the amount of the prize fund drawn / to be drawn does not exceed 5,000 GEL, a warning may be applied to the offender."**

  **This is the single most useful practical number in this document.** Keeping the total prize fund per stage at or below **5,000 GEL** preserves the regulator's discretion to issue a warning rather than a fine if the classification turns out to be wrong.

- **Unauthorised lottery:** 50,000 / 150,000 GEL (Lotteries Law Arts. 37²(2)–(3)).
- **Breach of permit conditions once permitted:** fines under Licences & Permits Law Art. 34, with amounts set per permit type by Lotteries Law Art. 37¹; unremedied breach → **fine trebled** (Art. 34(3)) → **permit revoked** (Art. 34(4)).

### 3.7 AML

**Law on Facilitating the Prevention of Money Laundering and the Financing of Terrorism**, [Primary — matsne 4690334](https://matsne.gov.ge/ka/document/view/4690334):

- **Art. 3(b.b):** "a lottery organiser, an organiser of a game of chance or a prize game" is an **accountable person** (ანგარიშვალდებული პირი). A promotional-draw permit holder is a "თამაშობის ორგანიზატორი" under Lotteries Law Art. 3(p), so this bites.
- **Art. 9(3)(a):** CDD triggered on receipt of funds or **payment of a win** where the transaction value (or linked transactions) exceeds **5,000 GEL**.
- **Art. 9(3)(b):** CDD triggered on establishing a business relationship — *registering a client as a player* — for **systemic-electronic** lotteries/games of chance/prize games.
- **Art. 9(4):** thresholds are irrelevant where there is suspicion of ML/TF.

**Inference:** with free entry and per-winner prize values well under 5,000 GEL, no transaction-level CDD trigger arises under (a). Whether (b) applies to an online promotional draw depends on the unresolved "systemic-electronic promotional draw" question in §3.1. Baseline accountable-person duties (internal policy, risk assessment, reporting channel to the Financial Monitoring Service) would still attach on the face of Art. 3(b.b). **Confirm with counsel.**

---

## 4. Age gating

### 4.1 What the statute actually says

**Art. 32(1)** (as amended by Law №2584 of 09.02.2023):

> „აკრძალულია 25 წლამდე ასაკის საქართველოს მოქალაქის, 18 წლამდე ასაკის უცხო ქვეყნის მოქალაქის/მოქალაქეობის არმქონე პირის აზარტული ან/და მომგებიანი თამაშობის **(გარდა წამახალისებელი გათამაშებისა)** მოწყობის ადგილზე სათამაშოდ შესვლა ან/და თამაშობაში (მათ შორის, სისტემურ-ელექტრონული ფორმით ორგანიზებულ …) მონაწილეობა.“

*"It is prohibited for a **Georgian citizen under 25 years of age**, or a **foreign citizen / stateless person under 18**, to enter a place where a game of chance and/or prize game **(except a promotional draw)** is arranged, or to participate in the game (including one organised in systemic-electronic form)."* The organiser must demand an identity document and verify age.

**Art. 32(1¹):** persons on the **dependent-persons list** (დამოკიდებულ პირთა სია) and the **prohibited-persons list** (აკრძალულ პირთა სია) may not enter or be admitted to games of chance / prize games — again **"(გარდა წამახალისებელი გათამაშებისა)"**.

**Art. 32(1²):** the Revenue Service processes the personal data on those lists and, on the organiser's request, discloses only whether a given person is barred.

The same carve-out is repeated in:
- **Art. 3(b²), 3(b³):** the register definitions themselves say "(except promotional draws)".
- **Art. 29(1)(u¹):** the organiser's duty not to admit under-25/under-18/listed persons — "(except promotional draws)".
- **Administrative Offences Code Arts. 176¹, 176⁵:** the offences of admitting under-age or listed persons — both carved out for promotional draws.

**Art. 32(2)** is the only under-18 rule in this article, and it is lottery-specific:
> *"It is prohibited to sell or otherwise distribute a lottery ticket to a person under 18 and to pay out a win to them."*
Note "სხვაგვარი გავრცელება" ("otherwise distribute") — free distribution counts. But this applies to **ლატარიის ბილეთი**, not to promotional-draw tickets.

### 4.2 Conclusion

**The Lotteries Law imposes no minimum age on a promotional draw, and the prohibited/dependent-persons registers do not apply to one.** That is a deliberate legislative choice repeated in six places, not an oversight.

### 4.3 What TFC should nevertheless implement

**Recommendation: hard 18+ gate on account creation, coin holding, prediction entry, leaderboard placement and prize eligibility.** Reasons:

1. **Data protection makes under-16 impractical.** PDP Law Art. 7(1): consent-based processing of a minor's data is permissible only from **16**; below 16 requires the **parent's or legal representative's consent**, and Art. 7(2) requires the controller to take "reasonable and adequate measures" to verify that consent exists. Verifiable parental consent flows are a substantial build.
2. **Tax withholding on a minor's prize** (§6) is administratively messy and may require a parent/legal representative.
3. **Advertising Law Art. 14** restricts exploiting minors' credulity and inexperience in advertising — a coin-staking loop marketed at under-18s is exposed here.
4. **Classification risk.** If a regulator later characterises the product as a totalizator, having admitted under-25 Georgian citizens converts a classification dispute into an age-limit breach under AOC Art. 176¹.
5. **Reputational.** A promotion that teaches a betting-shaped loop to under-18s is the kind of thing that attracts the 2022 reform's political energy, regardless of the letter of Art. 32.

**If TFC insists on including under-18s** (their audience skews young), the least-bad structure is a **separate non-staking track** — predictions for glory, no coin balance, no burn, no leaderboard prize eligibility — with 16+ self-consent and 13–16 parental consent. Mark this as a product/compliance decision, not a legal safe harbour.

*I found no ministerial or Revenue Service act imposing an age floor on promotional draws. If one exists it would sit below the statute; counsel should confirm.*

---

## 5. Advertising

**Law of Georgia on Advertising** (რეკლამის შესახებ), [Primary — matsne 31840](https://matsne.gov.ge/ka/document/view/31840). Art. 8³ was inserted by Law №1188 of 22.12.2021 (the 2022 reform), amended by Law №2588 of 09.02.2023 and **Law №1826 of 25.06.2026**.

**Art. 8³(1):** advertising of a game of chance, totalizator, loto, bingo, or of their organisers, **in any form or by any means, including via electronic communication networks, is inadmissible**, save four exceptions: (a) placement on a website where the enumerated systemic-electronic gambling forms are permitted; (b) at a sports event / sports competition venue or a sports organisation's premises **as consideration for sponsoring** them; (c) visually on the gambling premises themselves, ≤10 m², and the only such ad there; (d) at international airports and border crossings.

**Art. 8³(3):** the sponsorship exception in (1)(b) permits **visual form only**, on the **inner perimeter** of the venue, by banner and/or on participants' uniforms.

**Art. 8³(4) — the operative provision for TFC:**

> „წამახალისებელი გათამაშების მოწყობის ნებართვის საფუძველზე ჩასატარებელი გათამაშების შესახებ რეკლამის რაიმე ფორმით ან საშუალებით, მათ შორის, ელექტრონული საკომუნიკაციო ქსელით, გავრცელება დაუშვებელია, **თუ წამახალისებელი გათამაშების მოწყობის ნებართვა გაცემულია აზარტული თამაშობის ორგანიზატორზე, ტოტალიზატორის ორგანიზატორზე, ლოტოს ორგანიზატორზე ან/და ბინგოს ორგანიზატორზე**, გარდა იმ შემთხვევისა, თუ: …“

*"Dissemination of advertising about a draw to be held under a promotional-draw permit, in any form or by any means including electronic communication networks, is inadmissible **if the promotional-draw permit has been issued to a gambling organiser, a totalizator organiser, a loto organiser and/or a bingo organiser**, except where: (a) it is placed on a website where the enumerated systemic-electronic gambling forms are permitted; (b) it is disseminated only on the inner perimeter of a gambling / totalizator / loto / bingo venue."*

### Conclusion

**The gambling advertising ban does not catch TFC.** The Art. 8³(4) prohibition is expressly conditional on the permit holder being a licensed gambling operator. TFC is an MMA promotion, not a gambling organiser. Promoting the prediction game on tfc.ge and on social media is lawful.

### Guardrails

1. **Never let a licensed bookmaker hold or co-hold the permit**, and never structure it as a joint promotion with one. That single fact flips Art. 8³(4) on.
2. **Do not use gambling vocabulary in marketing.** Avoid ფსონი (bet), კოეფიციენტი (odds), ბუკმეიკერი (bookmaker), ტოტალიზატორი. Use პროგნოზი (forecast), ქულა/მონეტა (points/coins), ჩემპიონატი/კონკურსი (championship/competition). This is not cosmetic: naming is evidence of characterisation for both Art. 8³ and Art. 3(o.c).
3. **Bookmaker sponsorship of TFC events is separately regulated.** If a licensed bookmaker sponsors TFC, its branding is confined to the Art. 8³(1)(b)/(3) exception — visual only, inner perimeter, banners/uniforms. Keep that entirely separate from the prediction game's own creative.
4. **Advertising Law Art. 14** — protection of minors: no inducing minors to persuade parents to buy, no suggesting possession confers superiority over other minors, no disregarding the skill level needed to use the product.
5. **AOC Art. 158⁵** penalises breaches of the gambling-advertising and signage rules (including product placement in licensed broadcasters' programmes) — the exposure if the classification changes.

---

## 6. Tax

**Tax Code of Georgia**, [Primary — matsne 1043717](https://matsne.gov.ge/ka/document/view/1043717).

### 6.1 Withholding on prizes — TFC is a tax agent

**Art. 154(1)(e):**
> „წამახალისებელი გათამაშების, სამორინეს (აზარტული ტურნირის მოწყობის ნაწილში), აზარტული კლუბის (აზარტული ტურნირის მოწყობის ნაწილში), ლოტოს, ბინგოსა და ლატარიის მომწყობი პირი, რომელიც ფიზიკურ პირს უხდის მოგებას.“

*"A person arranging a **promotional draw**, a casino (as regards gambling tournaments), a gambling club (as regards gambling tournaments), loto, bingo or a lottery, **who pays a win to a natural person**"* — is a **tax agent** obliged to withhold tax at source.

**Rate: 20%** — Art. 81(1): *"The taxable income of a natural person is taxed at 20 per cent unless otherwise provided by this Code."*

**Remittance timing — Art. 154(3)(a):** transfer to the budget **at the moment of payment**; where the payout is **in non-monetary form, on the last day of the relevant month**. This is the operative rule for merch and event tickets.

**Reporting — Art. 154(3)(c.a):** file the certificate with the tax authority **by the 15th of the month following the month of withholding**, stating the recipient's registration number, name, address, total income for the period and total tax withheld.

### 6.2 No exemption applies

**Art. 82(1)(ღ)** exempts *"a win obtained from a **lottery**, the value of which does not exceed **1,000 GEL**"*.

**This is lottery-specific.** I found no equivalent exemption for wins from a promotional draw anywhere in Art. 82. **Inference (flagged):** a promotional-draw prize is taxable to the winner from the first lari, and TFC must withhold 20% of its value.

**Interaction to confirm with counsel:** Art. 154(1)(m) makes a person who transfers property **gratuitously** to a non-entrepreneur individual a tax agent, **except** transfers of property worth **under 1,000 GEL to the same individual in a tax year**, with the withholding mechanics set by the Minister of Finance. If TFC's prizes were characterised as gratuitous transfers rather than "wins", a 1,000 GEL/year de minimis could apply. Art. 154(1)(e) is the more specific rule for a promotional draw and should prevail (*lex specialis*), so **assume no de minimis** — but this is worth a written position from a Georgian tax adviser, since it materially changes the cost of a merch-only prize pool.

### 6.3 Practical consequence

**Gross up.** If TFC hands a winner a 400 GEL jacket, TFC owes 100 GEL to the budget (400 = 80% of a 500 GEL gross value) unless it deducts from the winner — which is impossible with a physical prize. **Budget prize cost at ~125% of retail value.**

State this explicitly in the T&Cs: *"Any income tax arising on the prize is borne and remitted by the Organiser; the stated prize value is the gross value for tax purposes."*

### 6.4 Organiser side

- **Art. 82(1)(ძ)** exempts income of gambling club and totalizator arrangers from *that activity* — not relevant to TFC.
- **Art. 80(8) / Art. 81(3¹), (3³)** deal with player withdrawals from slot halls and systemic-electronic gaming accounts. **Art. 80(8) expressly excludes "systemic-electronic promotional draws"** from that regime — a useful signal that an electronic promotional draw is *not* treated as a gaming account for personal-income-tax purposes.
- Prize cost, the 15,000 GEL permit fee and the 10% gaming-business fee should be ordinary deductible business expenses under Georgia's distribution-based corporate tax. **Confirm with a Georgian tax adviser** — I did not verify this against the corporate-tax chapter.

---

## 7. Data protection

**Law of Georgia on Personal Data Protection** (პერსონალურ მონაცემთა დაცვის შესახებ), No. 3144-XIმს-Xმპ of **14 June 2023**, published 03.07.2023, **in force 1 March 2024** (Art. 90(2)); Arts. 31, 33, 80 and 82 (DPIA and DPO) **in force 1 June 2024** (Art. 90(3)). [Primary — matsne 5827307](https://matsne.gov.ge/ka/document/view/5827307)

### 7.1 IMPORTANT — the supervisory authority has changed

**The Personal Data Protection Service is no longer the regulator.** The current consolidated text of the Law refers throughout to the **State Audit Office of Georgia** (სახელმწიფო აუდიტის სამსახური) and the **Auditor General** (გენერალური აუდიტორი). I counted 107 references to the State Audit Office and only 3 residual references to the Personal Data Protection Service — all three in spent transitional provisions (Art. 88(4)) requiring the old Service's head to issue implementing acts before 1 March 2024.

The change was made by **Law of Georgia №1054 of 12 November 2025** (published 17.11.2025), noted against the amended articles. Concretely, the Law now provides:
- **Art. 28:** processing records and notification duties run **to the State Audit Office**.
- **Art. 29:** incident notification **to the State Audit Office**.
- **Art. 33(4), (8):** the DPO liaises with, and is notified to, the **State Audit Office**.
- **Art. 33(10):** the **Auditor General** issues the normative act defining which controllers/processors are *exempt* from the DPO duty.
- **Art. 34(1):** special representatives are registered under an act issued by the **State Audit Office**.
- **Arts. 86–87:** offences of obstructing the **State Audit Office** / failing to comply with its lawful demand.
- **Art. 40:** the **Auditor General** issues normative acts in the data protection field.

I could not reach personaldata.ge (no response), which is consistent with the Service having been wound up. *Secondary sources* (Georgia Today; DataGuidance) report the Personal Data Protection Service ceased to exist on **2 March 2026** with functions transferred to the State Audit Office. **Treat the exact transfer date as needing confirmation**; the substantive point — that the State Audit Office is now the addressee — is established from the primary consolidated text.

**Practical consequence for TFC:** any privacy notice, DPO notification, incident report or breach-response runbook that names the "Personal Data Protection Service" is out of date. Address the **State Audit Office**.

### 7.2 Lawful basis (Art. 5(1))

The available grounds include:
- **(a)** the data subject's **consent** to processing for one or more specific purposes;
- **(b)** processing **necessary to perform an obligation under a transaction** with the data subject, or to conclude one at their request;
- **(i)** the controller's or a third party's **significant legitimate interests**, unless overridden by the data subject's rights — *and the text expressly names minors*: „გარდა იმ შემთხვევისა, თუ არსებობს მონაცემთა სუბიექტის (მათ შორის, არასრულწლოვანის) უფლებების დაცვის აღმატებული ინტერესი“;
- **(k)** processing necessary to consider the data subject's application (to provide a service to them).

**Art. 5(2):** the **burden of justifying the legal basis rests on the controller.**

**Recommended split:**
| Processing | Basis |
|---|---|
| Account, coin balance, predictions, leaderboard, prize fulfilment | **Art. 5(1)(b)** — performance of the T&Cs as a transaction |
| Age verification and identity checks for prize award | **Art. 5(1)(b)** + **(d)** (statutory duties, incl. tax withholding) |
| Tax withholding records | **Art. 5(1)(c)/(d)** — provided by law |
| Marketing emails/SMS/push | **Art. 5(1)(a)** consent — mandatory, see Art. 12 |
| Publishing the winner's display name on a public leaderboard | **Art. 5(1)(a)** consent — do not rely on legitimate interests for public display |

### 7.3 Direct marketing (Art. 12) — strict

- **Art. 12(1):** regardless of how data were collected, processing for **direct marketing requires the data subject's consent**.
- **Art. 12(2):** for data **beyond** name, surname, address, phone number and email, direct marketing requires **written consent**.
- **Art. 12(3):** before obtaining consent and while marketing, explain **clearly and in plain language** the right to withdraw at any time and the mechanism for doing so.
- **Art. 12(4):** stop within a reasonable period and **no later than 7 working days** of the request.
- **Art. 12(5)–(6):** the opt-out must be available **in the same form as the marketing itself** and must be **simple**, with a clear, easily perceptible instruction.
- **Art. 12(7):** **no fee or other restriction** may be imposed on withdrawing consent.
- **Art. 12(8):** the **burden of proving** consent, and the simplicity/accessibility of the opt-out, is on the controller.
- **Art. 12(9):** **log the time and fact** of consent and of withdrawal, and retain for the duration of the marketing plus **1 year** after it stops.

### 7.4 Privacy notice (Art. 24(1)) — required content

Provide, **before or at the start of collection**, at minimum:
- (a) identity/name and contact details of the controller, its representative and/or processor;
- (b) the **purposes and legal basis** of processing;
- (c) whether providing the data is mandatory and, if so, the **legal consequences of refusing**; and whether collection is required by law or is a precondition for concluding a contract;
- (d) the **significant legitimate interests**, if relying on Art. 5(1)(i);
- (e) the **DPO's identity and contact details**, if one exists;
- (f) the identity or **categories of recipients**;
- (g) planned **transfers abroad**, the safeguards, and any transfer permit;
- (h) the **retention period**, or the criteria for determining it;
- (i) the **data subject's rights under Chapter III** of the Law.

**Art. 24(5):** provide this in **simple, comprehensible language — especially where the data subject is a minor.**

Chapter III rights to describe: information (Art. 13), access and copy (Art. 14), rectification/update/completion (Art. 15), cessation/erasure/destruction (Art. 16), blocking (Art. 17), **portability (Art. 18)**, rights regarding **automated individual decision-making (Art. 19)**, withdrawal of consent (Art. 20), and the **right to complain (Art. 22)**.

*Note Art. 19 — automated individual decision-making. Automatic disqualification for suspected multi-accounting is arguably an automated decision with legal or similarly significant effect. Build a human-review route into the anti-fraud flow.*

### 7.5 Minors (Art. 7)

- **Art. 7(1):** processing a minor's data on **their own consent** is permissible **from age 16**; **under 16** requires the **parent's or other legal representative's consent** — save where the law expressly requires the consent of *both* a 16–18-year-old and their parent.
- **Art. 7(2):** take **reasonable and adequate measures to verify** that the parent's/representative's consent exists.
- **Art. 7(3):** special-category data of a minor — only on the **written consent** of the parent/legal representative.
- **Art. 7(4):** the controller must **take into account and protect the best interests of the minor**.
- **Art. 7(5):** consent is **invalid** if the processing endangers or harms the minor's best interests.
- **Art. 7(6):** Art. 7 does not extend to Civil Code questions of transaction validity (i.e. capacity to contract is a separate analysis).

See §4.3 — this is a principal reason to gate at 18+.

### 7.6 DPO (Art. 33) — probably not mandatory, but document the assessment

**Art. 33(1)** makes a DPO mandatory for: public institutions, insurers, commercial banks, microfinance organisations, credit bureaux, electronic communications companies, airlines, airports, medical institutions, **and any controller/processor that processes the data of a large number of data subjects (დიდი რაოდენობით მონაცემთა სუბიექტების მონაცემებს) or carries out systematic and large-scale monitoring of their behaviour.**

- **Art. 33(2):** others may appoint one voluntarily.
- **Art. 33(3):** the role may be filled by an employee **or an external person under a services contract**, and may be combined with other functions absent a conflict.
- **Art. 33(8):** notify the DPO's identity and contact details to the **State Audit Office within 10 working days** of appointment or change; the Office publishes it. Also **publish the DPO's identity and contact details proactively on the website**.
- **Art. 33(10):** the **Auditor General** defines by normative act which controllers/processors are **not** obliged to appoint a DPO.

**Assessment (inference):** a Georgian MMA promotion's prediction game is unlikely to reach "large number of data subjects" or "systematic and large-scale monitoring". But a coin-staking product with per-user behavioural leaderboards is closer to "monitoring of behaviour" than an ordinary marketing list, and **Art. 33(10) has not been checked against the current Auditor General act** — I did not retrieve it. **Action: obtain the Auditor General's Art. 33(10) act and record a written DPO-necessity assessment.** Appointing an external DPO on a services contract is cheap insurance if the answer is unclear.

### 7.7 Other duties

- **Art. 26:** **privacy by default** — "greater concealment of data" must be the method automatically applied when designing a new product or service before any alternative approach is chosen. This is a design-time obligation and applies directly to building this feature.
- **Art. 27:** data security — organisational and technical measures.
- **Art. 28:** maintain **processing records** in writing or electronically (controller: Art. 28(1)(a)–(h); processor: Art. 28(2)). **There is no general registration or filing duty** — records are kept and produced on demand.
- **Art. 29:** notify **incidents** to the State Audit Office; **Art. 30:** notify data subjects where the incident poses a significant threat to their fundamental rights.
- **Art. 31:** **DPIA** where processing is likely to entail high risk.
- **Art. 32:** duties on obtaining and on withdrawal of consent.
- **Art. 34:** a controller registered **outside Georgia** that processes using technical means located in Georgia must appoint and register a **special representative** *before* processing begins, and only acquires the right to process **after registration**. Not applicable to a Georgian-registered TFC entity — but relevant if the platform is operated by a foreign group company.
- **Art. 36:** processor obligations — put a written processing agreement in place with the hosting/analytics/email vendors.
- **Arts. 37–38:** transfers to other states and international organisations — relevant if using non-Georgian cloud/analytics/email providers. Check whether the destination is on the adequate-protection list or whether appropriate safeguards under Art. 38 are needed.

**Summary answer to "is there a registration duty":** **No general registration.** The only filing duties are DPO notification (Art. 33(8)), special-representative registration for foreign controllers (Art. 34), incident notification (Art. 29), and any transfer permit under Art. 37.

---

## 8. T&Cs / official rules checklist

The statutory floor for a permitted promotional draw is **Lotteries Law Art. 12(1)(b)** (regulation contents) plus **Art. 16(1)** (publicity + commission). The commercial clauses below sit on top. Items marked ⚖ are statutory; the rest are risk-management.

### Identification and scope
- [ ] ⚖ Full legal name, legal address, phone, and **permit number** of the organiser *(the Art. 12(1)(a.d)-analogue website disclosure standard; mandatory in Georgian for licensed online games — adopt it voluntarily)*
- [ ] ⚖ **Period and place** of the game (Art. 12(1)(b.a)); explicit start/end date-times with time zone (Asia/Tbilisi)
- [ ] ⚖ **Purpose and reason of the game** (Art. 12(1)(b.e)) — state that it promotes TFC events, tickets and merchandise
- [ ] ⚖ Statement that the regulation is **public and freely available** (Art. 16(1))
- [ ] Georgian-language version is the governing text; English/other versions are convenience translations

### Eligibility
- [ ] **Minimum age 18** at registration and at prize award; TFC will verify by identity document before payout
- [ ] Territory: residents of Georgia *(decide deliberately — non-residents complicate withholding and delivery)*
- [ ] Exclusion of TFC employees, contractors, fighters on the card, officials, judges, matchmakers, their household members and anyone with access to non-public information about fight outcomes or bookings — **this is not boilerplate**: Lotteries Law Art. 3(o.c) prohibits organising a totalizator where the result may be known in advance to a party, and the promotional-draw definition requires the result not to be "specially arranged"
- [ ] One account per natural person; account must be in the participant's own real name

### How coins work — the core protective clauses
- [ ] Coins are **granted free of charge**; ⚖ **no fee of any kind may be charged for participation** (Art. 3(o.d) final sentence) — state affirmatively that TFC will never charge
- [ ] Coins **have no monetary value**, are **not** electronic money, a payment instrument, a security, a voucher or property
- [ ] Coins are **non-purchasable** — there is no mechanism to buy coins, now or in future, and no third party may sell them
- [ ] Coins are **non-transferable** between accounts and **non-assignable**
- [ ] Coins are **non-redeemable** — they cannot be exchanged for money, goods, services or any other benefit except through the published leaderboard prize mechanism
- [ ] Coins are a **revocable licence**, not the participant's property; TFC may adjust, reset or void balances for breach or error, with a stated review route
- [ ] Coins **expire** at the end of each season and do not carry over *(recommended — caps accumulated "value" and refreshes the promotional purpose for each permit stage)*
- [ ] Explicit statement: **losing a prediction burns the staked coins and costs the participant nothing of monetary value**

### Game mechanics
- [ ] Full description of markets offered (winner / method / round), how multipliers are set and published, and when they lock
- [ ] Chaining/accumulator rules: how multipliers compound, maximum legs, maximum single-stake, maximum payout cap
- [ ] Entry deadline per fight/event; no edits after lock
- [ ] Settlement source: the **official TFC result** as announced by the commission/promotion, and the timestamp at which it is taken as final
- [ ] Settlement of ambiguous methods (e.g. TKO vs KO vs doctor stoppage vs corner retirement; DQ; technical decision; majority/split/unanimous decision all counting as "decision")

### Void and cancelled fight handling — do this properly
- [ ] **Fight cancelled or postponed beyond the event**: staked coins returned; the leg is voided and removed from any accumulator (remaining legs settle on their own multipliers)
- [ ] **Fighter substitution**: all predictions on that bout are voided and coins returned
- [ ] **Weight-class or scheduled-rounds change**: round-market predictions voided; winner-market predictions stand *(state which)*
- [ ] **No contest / draw**: define the outcome for each market
- [ ] **Result overturned after the fact** (commission reversal, doping): define whether settlement stands as at the original announcement — **recommend that it stands**, to avoid retroactive leaderboard churn
- [ ] **Whole event cancelled**: all stakes returned; the stage's leaderboard either extends or is settled on results to date — say which
- [ ] ⚖ Note the constraint: **the regulation may not be amended before the current stage ends** (Art. 13(4)), so void rules must be complete at filing

### Prizes
- [ ] ⚖ **Prize fund**, **list and quantity of prizes**, **unit value**, **order of award**, and the **date and address of the draw/award** (Art. 12(1)(b.z))
- [ ] Prize values stated as **gross values including tax** (see §6.3)
- [ ] ⚖ **Payout deadlines**: statutory default is within **30 calendar days** of the draw, and **no later than 6 days** after the winning ticket is presented (Art. 12(1)(b.b))
- [ ] Prize **substitution**: TFC may substitute a prize of equal or greater value where the stated prize becomes unavailable — with an express statement that a cash alternative is **never** offered *(cash prizes are a classification risk — see §9)*
- [ ] Non-transferability of prizes; delivery method and territory; who bears delivery cost
- [ ] Unclaimed prizes: claim window, and what happens after it lapses
- [ ] ⚖ Statement that the prize fund may not be encumbered with obligations other than those owed to participants, and may not be used in financial, commercial or production turnover (Art. 3(k))

### Winner selection, verification and integrity
- [ ] Exact ranking rule: top 10 by coin balance at the stated cut-off; **published tie-break** (earliest to reach the balance; then most correct predictions; then random draw before the commission)
- [ ] ⚖ The **commission** that determines and confirms winners under the regulation (Art. 16(1)); its composition and how it records decisions
- [ ] Winner verification: identity document check, age check, confirmation of eligibility, and tax data required for withholding
- [ ] Right to disqualify and re-award to the next-ranked participant on failed verification
- [ ] Winner publication: display name only; ⚖ obtain **consent** for public display (PDP Art. 5(1)(a))

### Anti-multi-accounting and fair play
- [ ] Prohibition on multiple accounts, shared accounts, accounts opened for another person, automation/bots/scripts, exploiting bugs or pricing errors
- [ ] Detection basis stated in the privacy notice (device, IP, payment-free signals) and the retention period
- [ ] **Human review before disqualification** (PDP Art. 19) and a named appeal route
- [ ] Voiding of predictions and forfeiture of coins on breach; permanent exclusion for repeat abuse
- [ ] Manifest-error clause: TFC may void predictions placed on a clearly erroneous multiplier

### Disputes and law
- [ ] ⚖ **Claims (pretension) procedure and deadline — must not exceed 30 calendar days** from when the claim arises (Art. 12(1)(b.c)); ⚖ TFC must decide within the stated deadline (Art. 29(1)(e), (gh))
- [ ] Contact channel for claims and the form they must take
- [ ] **Governing law: Georgia.** Jurisdiction: courts of Tbilisi *(or arbitration — decide deliberately)*
- [ ] Limitation of liability, force majeure, and technical-failure handling (server outage during entry window)
- [ ] Amendment clause **constrained by Art. 13(4)** — no mid-stage changes to the regulation; changes take effect from the next stage, with notice

### Data protection
- [ ] Separate **privacy notice** meeting **PDP Art. 24(1)(a)–(i)** — see §7.4
- [ ] Separate, unbundled **marketing consent** with a simple same-channel opt-out (PDP Art. 12)
- [ ] Retention schedule: tax records per the Tax Code; marketing consent logs for marketing period + 1 year (PDP Art. 12(9)); game data for the claim window plus a defined tail
- [ ] Named contact for data subject requests; **State Audit Office** identified as the supervisory authority for complaints (**not** the Personal Data Protection Service)

### Responsible-play framing (not statutorily required for promotional draws — recommended)
- [ ] Prominent statement that no money can be spent, no money can be won, and coins have no value
- [ ] Self-exclusion / account-closure route
- [ ] Signposting to gambling-help resources for anyone who recognises the pattern

---

## 9. Riskiest design choices, ranked

Ranked by how directly each would flip the product from "free promotional game" into "unlicensed gambling", and by how hard the resulting position would be to defend.

### 1. Selling coins for money — in any form (catastrophic)
Art. 3(o.d) is categorical: **„დაუშვებელია წამახალისებელ გათამაშებაში მონაწილეობისთვის ნებისმიერი ფორმით საფასურის დაწესება“** — *"it is inadmissible to set a fee **in any form** for participation."* Selling coins does two things at once: it destroys eligibility for the promotional-draw category, and it supplies the missing element of a **totalizator** under Art. 3(o.c) (a stake, placed on a forecast, with payout proportional to stake and result). The result is unlicensed operation of a game requiring a 30,000–300,000 GEL/yr (or 100,000 GEL/yr online) permit. **Never build a coin store. Do not build the schema for one.**

### 2. Cash prizes, cash equivalents, or any cash-out (severe)
Art. 3(a) defines games of chance partly by *"the possibility of a **monetary** win"* (ფულადი მოგება). Merchandise and event tickets keep the product outside that definition. Cash, bank transfers, gift cards, prepaid cards, crypto, or "buy anything at TFC's store with your coins" all move it inside — and make the "coins are a bet" characterisation nearly unanswerable, because the coin now has a demonstrable exchange rate. **Prizes must be in-kind, non-fungible and explicitly non-substitutable for cash.**

### 3. Coin transfers between users (severe)
The moment coins move between accounts, a secondary market can price them, and a coin acquires real value even though TFC never sold one. That defeats "no monetary value" in the T&Cs as a matter of fact, and supplies the consideration element indirectly — a user who buys coins from another user has paid a fee for participation in substance. It also creates AML exposure (a value-transfer rail inside an accountable person's product, AML Law Art. 3(b.b)). **No gifting, no trading, no "send coins to a friend", no shared balances.**

### 4. Any purchase-linked route to more coins (high)
"Buy an event ticket, get 500 coins." "Buy merch, get a top-up." "Subscribe for a monthly coin allowance." Each is a **საფასური in kind** for participation. Note the Art. 3(o.d) purpose clause cuts the other way here — the draw exists *for the purpose of* selling product — so there is an argument that purchase-linked entries are the *point* of a promotional draw. **But the free-ticket and no-fee sentences are absolute and later in the same subparagraph.** The safe structure: everyone gets coins free; purchases may earn *non-coin* benefits. Treat any coin-for-purchase mechanic as requiring counsel sign-off, not a product decision.

### 5. Re-buying or topping up after a loss (high)
The "buy back in after you bust" loop is the single most gambling-shaped mechanic there is, and it converts a promotion into a monetisable game. If losing must be recoverable, do it by **free, time-based, capped replenishment** — e.g. a fixed free grant at the start of each event card, identical for every participant, with no way to accelerate it by spending or watching monetised ads. An **ad-gated** top-up is a fee in kind (the participant renders value); avoid it.

### 6. Admitting under-18s while awarding real prizes (high, but different in kind)
The Lotteries Law does not bar it (§4). The exposure is elsewhere: PDP Art. 7 verification duties, tax withholding on a minor's prize, Advertising Law Art. 14, and the fact that admitting under-25 Georgian citizens converts any adverse reclassification into an *additional* age-limit offence under AOC Art. 176¹. **Gate at 18+.**

### 7. Running it without a permit while the prize fund exceeds 5,000 GEL (moderate, quantifiable)
AOC Art. 176⁴ fines an unpermitted promotional draw **20,000 GEL + 10% of the prize fund**, but expressly allows a **warning** where the prize fund does not exceed **5,000 GEL**. Keeping each stage's total prize fund at or below 5,000 GEL keeps the cheapest possible landing if the classification is wrong. Above that, the warning option disappears.

### 8. Betting vocabulary and bookmaker adjacency (moderate)
Calling multipliers "კოეფიციენტი", stakes "ფსონი", or the product a "ტოტალიზატორი" is evidence of characterisation under both Art. 3(o.c) and Advertising Law Art. 8³. Worse: if a licensed bookmaker holds or co-holds the promotional-draw permit, **Art. 8³(4) switches the advertising ban on**, and the whole marketing plan becomes unlawful. Keep bookmaker sponsorship of TFC events strictly separate from this product — no co-branding, no shared landing pages, no shared permit.

### 9. Mid-stage rule changes (moderate, procedural)
Art. 13(4) prohibits amending the regulation before a stage ends, and Civil Code Art. 759 prohibits changes that harm participants. Multipliers that TFC adjusts after entries open, or a leaderboard formula tweaked mid-season, breach both. Build the season as a closed stage: publish everything up front, change nothing until it ends.

### 10. Continuous high-frequency play (low legal, high political)
A product that runs only around TFC event cards, with a fixed free allocation per card, reads as a promotion. A product with daily markets, live in-play predictions and compounding parlays reads as a bookmaker regardless of the currency, and invites a regulator to look hard at Art. 3(o.c). **Bind the game tightly to TFC's own event calendar** — this also strengthens the Art. 3(o.d) "promotion of a specific product/service" element if the permit route is taken.

---

## Open questions for a Georgian gaming lawyer

1. **Does a free, non-purchasable, non-transferable, non-redeemable virtual coin constitute a „ფსონი" (bet) for the purposes of Art. 3(o.c) (totalizator)?** The statute does not define ფსონი. This is the determinative question. Ask for any Revenue Service practice, ministerial interpretation, or court decision.

2. **Can a leaderboard-ranked, skill-scored contest be permitted as a წამახალისებელი გათამაშება at all**, given that Art. 3(o.d) requires the win to fall on a ticket **by chance** and "not be specially arranged"? If not, is the Revenue Service willing to permit a hybrid (skill qualification + random final draw among qualifiers)?

3. **What are the Minister of Finance's criteria under Art. 12(1)(b.e)** for a promotional draw's "reason and purpose" (თამაშობის მიზეზი და მიზანი)? I could not locate this act. Does "promoting TFC events, tickets and merchandise" satisfy it?

4. **How is an online-only promotional draw permitted in practice?** Art. 11(3) contemplates systemic-electronic form, and Arts. 12(1)(a) and 13(5) carve out ticket-printing requirements for it — but Art. 11(1) contains **no separate systemic-electronic permit type for promotional draws**. Does the ordinary Art. 11(1)(a) permit cover an online game, and what does the Revenue Service require in the regulation?

5. **Does Art. 4 (the skill exclusion) apply to forecasting the outcome of a real sporting event?** The wording requires that "an element of chance is **not provided for**". Is the test applied to the game's own mechanics or to the underlying event? Any precedent on fantasy sports or prediction contests in Georgia?

6. **Could the product run instead as a Civil Code კონკურსი (Arts. 755–762) with no permit** — and if so, what design features are necessary to keep it out of Arts. 951–952 (unenforceable gaming/wagering)? What is the realistic enforcement risk of that route?

7. **Tax:** confirm that Art. 154(1)(e) (20% withholding from the first lari) governs promotional-draw prizes rather than Art. 154(1)(m) (gratuitous transfer, 1,000 GEL/year de minimis). Confirm the mechanics and timing for **non-monetary** prizes under Art. 154(3)(a), and whether prize cost, the 15,000 GEL permit fee and the 10% gaming-business fee are deductible business expenses.

8. **AML:** does a promotional-draw permit holder that never receives funds and pays only in-kind prizes below 5,000 GEL have substantive obligations under AML Law Arts. 3(b.b), 9(3), or only nominal accountable-person status? What is the minimum viable AML programme?

9. **Data protection:** obtain the **Auditor General's normative act under PDP Art. 33(10)** listing controllers exempt from the DPO duty, and confirm the exact date the **State Audit Office** assumed supervision (secondary sources say 2 March 2026). Confirm the current incident-notification channel and format.

10. **Age:** confirm that no subordinate act imposes a minimum age on promotional draws, and confirm whether admitting 16–18-year-olds to a non-staking track raises any issue under the Law on Family Values and Protection of Minors (cross-referenced in Advertising Law Art. 4(13¹)).

11. **What changed in the 25 June 2026 amendment (Law №1822)?** It touched Arts. 3, 13 and 16¹ among others. Secondary reporting indicates it concerned foreign-facing online gambling permits and higher penalties, but the effect on promotional draws should be verified line by line.

---

## Sources

### Primary

| Source | URL | Notes |
|---|---|---|
| Law of Georgia on Arranging Lotteries, Games of Chance and Other Prize Games (No. 1180, 25.03.2005) — Georgian consolidated | https://matsne.gov.ge/ka/document/view/30988 | **Governing text.** Last amended by Law №1822 of 25.06.2026, published 03.07.2026. Arts. 3, 4, 5, 6, 11, 12, 13, 16, 29, 32, 35, 36, 37, 37¹–37³ cited |
| Same law — English translation | https://matsne.gov.ge/en/document/view/30988 | Unofficial and lags the Georgian consolidated text; Georgian governs |
| Law of Georgia on Licence and Permit Fees (სალიცენზიო და სანებართვო მოსაკრებლების შესახებ) | https://matsne.gov.ge/ka/document/view/12880 | Art. 7(10)(a) — 15,000 GEL promotional-draw permit fee. Consolidated 25/06/2026 (Law №1824) |
| Law of Georgia on the Gaming Business Fee (სათამაშო ბიზნესის მოსაკრებლის შესახებ) | https://matsne.gov.ge/ka/document/view/22828 | Arts. 4(c), 5(d), 6 — 10% of prize fund, payable before the stage. Consolidated 25/06/2026 |
| Law of Georgia on Licences and Permits (ლიცენზიებისა და ნებართვების შესახებ) | https://matsne.gov.ge/ka/document/view/26824 | Arts. 25, 26 (20-day decision, tacit approval), 34 (sanctions, revocation) |
| Law of Georgia on Advertising (რეკლამის შესახებ) | https://matsne.gov.ge/ka/document/view/31840 | Art. 8³ (gambling ad ban; promotional-draw carve-out at 8³(4)), Art. 14 (minors). 8³ last amended by Law №1826 of 25.06.2026 |
| Tax Code of Georgia (საგადასახადო კოდექსი) | https://matsne.gov.ge/ka/document/view/1043717 | Arts. 80(8), 81(1), 82(1)(ღ), 82(1)(ძ), 154(1)(e), 154(1)(m), 154(3) |
| Law of Georgia on Personal Data Protection (No. 3144-XIმს-Xმპ, 14.06.2023) | https://matsne.gov.ge/ka/document/view/5827307 | In force 01.03.2024; Arts. 31/33/80/82 from 01.06.2024. Supervisory authority transferred to the **State Audit Office** by Law №1054 of 12.11.2025. Arts. 5, 7, 12, 19, 24, 26–34, 37–38, 88, 90 cited |
| Civil Code of Georgia (სამოქალაქო კოდექსი) | https://matsne.gov.ge/ka/document/view/31702 | Arts. 755–762 (public promise of reward; competition), Arts. 951–952 (game and wager; lottery) |
| Code of Administrative Offences (ადმინისტრაციულ სამართალდარღვევათა კოდექსი) | https://matsne.gov.ge/ka/document/view/28216 | **Art. 176⁴** (unpermitted promotional draw: 20,000 GEL + 10%; warning if prize fund ≤ 5,000 GEL); Arts. 158⁵, 176¹, 176⁵ |
| Law on Facilitating the Prevention of Money Laundering and the Financing of Terrorism | https://matsne.gov.ge/ka/document/view/4690334 | Art. 3(b.b) (game organisers as accountable persons); Art. 9(3)–(4) (thresholds) |
| Minister of Finance Order — Rule on registration, identification and verification of a player by holders of systemic-electronic lottery/gambling/prize-game permits | https://matsne.gov.ge/ka/document/view/5110247 | Scope; cross-reference to Financial Monitoring Service Head's Order №2 of 05.06.2020 |
| Revenue Service — departmental gaming-business permit register | https://www.rs.ge/GamblingBusiness | The public permit register maintained under the Licences and Permits Law |
| Revenue Service | https://www.rs.ge/ | Permit issuer (Lotteries Law Art. 12(1)) |
| Revenue Service Order №6329 of 17.04.2012 — approval of a promotional-draw regulation | https://matsne.gov.ge/ka/document/view/1646292 | Worked example of a რეგლამენტი's structure (issued under Lotteries Law Art. 5(3)) |
| State Audit Office of Georgia | https://sao.ge/ka | Current data protection supervisory authority per the consolidated PDP Law |

### Secondary — used only to locate primary sources or note practical interpretation

| Source | URL | Used for |
|---|---|---|
| Georgia Today — "Anti-Corruption Bureau, Personal Data Protection Service, and Business Ombudsman Office to be abolished" | https://georgiatoday.ge/anti-corruption-bureau-personal-data-protection-service-and-business-ombudsman-office-to-be-abolished/ | Reported date (2 March 2026) for the Personal Data Protection Service ceasing to exist — **not independently confirmed against primary source** |
| DataGuidance — Georgia jurisdiction page | https://www.dataguidance.com/jurisdictions/georgia-us | Locating the PDPS→State Audit Office transfer and the amending law number |
| Parliament of Georgia — news on amendments to the Lotteries Law | https://parliament.ge/en/media/news/latariebis-azartuli-da-momgebiani-tamashobebis-motsqobis-shesakheb-kanonshi-tsvlilebebis-shesakheb-kanonproekti-akhal-regulatsiebs-itvalistsinebs | Locating the 2026 amendment package |
| European Gaming — "Georgia proposes new permits for foreign-facing gambling operators" (24.06.2026) | https://europeangaming.eu/portal/latest-news/2026/06/24/207846/georgia-proposes-new-permits-for-foreign-facing-gambling-operators/ | Subject matter of the June 2026 amendments (foreign-facing permits; not relevant to promotional draws) |
| Andersen in Georgia — amendments to the gambling law | https://ge.andersen.com/georgia-introduces-amendments-to-gambling-law-to-regulate-online-gaming/ | Practitioner summary of the online-gaming amendments |

### Gaps I could not close

- The **Minister of Finance criteria under Lotteries Law Art. 12(1)(b.e)** (the "reason and purpose" test for promotional draws) — not located.
- The **Auditor General's normative act under PDP Law Art. 33(10)** (controllers exempt from the DPO duty) — not located.
- **Line-by-line effect of Law №1822 of 25.06.2026** on the Lotteries Law — the consolidated text is current, but I did not diff the amendment.
- **Whether the Personal Data Protection Service formally ceased on 2 March 2026** — established from secondary sources only; the substantive transfer to the State Audit Office is established from the primary consolidated text.
- **No case law or Revenue Service ruling** on free virtual-currency prediction games was located. If none exists, the classification question in §1.5 is genuinely novel in Georgia, and a **binding advance ruling from the Revenue Service** may be the only way to get certainty.
