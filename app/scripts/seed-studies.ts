/**
 * Seed 10 curated studies for preview / design work.
 *
 * All studies use public-domain translations (BSB/KJV/WEB) with verse text
 * embedded directly in markdown. Licensed translations (NIV/NLT/NASB/ESV) are
 * NEVER hardcoded here — users can still swap to those at runtime via the
 * reader's translation selector, which routes through the FUMS-tracked
 * API.Bible pipeline with the required citations.
 *
 * Topics selected for ages 15-35 engagement (anxiety, identity, doubt,
 * money, loneliness, etc.). Each anchor verse was editorially checked in
 * context — notably, Jeremiah 29:11 was REJECTED for "purpose & calling"
 * since in context it addresses the Babylonian exile community, not
 * individual life-planning. Romans 12:1-8 was substituted.
 *
 * Idempotent: existing slugs are skipped.
 *
 * Run: cd app && npx tsx scripts/seed-studies.ts
 */

import { getDb } from '../lib/db/connection';

const db = getDb();

type FormatType = 'quick' | 'standard' | 'comprehensive';
type TranslationId = 'BSB' | 'KJV' | 'WEB';

interface SeedStudy {
  title: string;
  slug: string;
  summary: string;
  formatType: FormatType;
  translation: TranslationId;
  categoryId: number;
  isFeatured: boolean;
  tags: string[];
  markdown: string;
  daysAgo: number;
}

const SEED_USER_ID = 1;

const STUDIES: SeedStudy[] = [
  {
    title: 'Peace That Guards the Mind: Anxiety and Philippians 4',
    slug: 'peace-that-guards-the-mind',
    summary:
      'Paul writes from a Roman prison and tells the Philippians not to be anxious about anything. A close reading of his prescription for a guarded mind.',
    formatType: 'comprehensive',
    translation: 'BSB',
    categoryId: 10,
    isFeatured: true,
    tags: ['Anxiety', 'Philippians', 'Prayer', 'Mental Health'],
    daysAgo: 2,
    markdown: `# Peace That Guards the Mind

## Introduction

Paul writes Philippians from prison, likely chained to a Roman guard, with his legal future uncertain. And yet the letter's dominant note is joy — and its most quoted prescription is for anxiety. That tension matters. Paul is not writing from a calm room about hypothetical worry; he is writing from confinement to a church that is itself under pressure.

> *"Be anxious for nothing, but in everything, by prayer and petition, with thanksgiving, present your requests to God. And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus."* — Philippians 4:6-7 (BSB)

## The Command and the Counter-Command

Paul does not say *try not to worry*. He issues an imperative — μηδὲν μεριμνᾶτε (*mēden merimnate*), "be anxious for nothing" — and then, in the same breath, gives the counter-action: **in everything** (ἐν παντί), present your requests.

The grammar is deliberate. *Nothing* anxious; *everything* in prayer. The scope is total.

### A Note on μεριμνάω (merimnaō, G3309)

The verb translated *be anxious* means "to be pulled in different directions, divided in mind." It is the same verb Jesus uses in Matthew 6:25-34 ("do not worry about your life"). Anxiety, in this Greek, is not a feeling to be managed but a fragmentation of attention to be healed.

## The Peace That Guards

> *"And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus."* — Philippians 4:7 (BSB)

The verb **φρουρήσει (phrourēsei, G5432)** is a military term — "to garrison, to stand sentinel over." Paul, who is himself under military guard in Rome, flips the image: the soldier outside his cell does not guard him; the peace of God guards his mind.

## What to Fill the Mind With

Paul does not stop at prayer. Two verses later he gives the positive instruction — what the mind is to dwell on when anxiety tries to return.

> *"Finally, brothers, whatever is true, whatever is honorable, whatever is right, whatever is pure, whatever is lovely, whatever is admirable — if anything is excellent or praiseworthy — think on these things."* — Philippians 4:8 (BSB)

### Key Observations

- **λογίζεσθε (logizesthe, G3049)** — "consider, reckon, take account of." An accounting word. Paul is telling them to keep a ledger of what is true and lovely, and to run their thoughts through that ledger.
- The list is not escapist. "True" comes first — Paul is not asking them to think positive thoughts but to think accurate ones.

## Reading in Context

Philippians 4:6-7 is often quoted alone, as a standalone anti-anxiety verse. In its literary setting it is the middle of a chain: rejoice (v.4) → be reasonable (v.5) → do not be anxious (v.6-7) → think on these things (v.8) → practice what you have learned (v.9). Paul's prescription is not a single verse but a rhythm.

## Questions for Reflection

1. Where in your life are you "pulled in different directions" right now?
2. What does it look like, practically, to "present everything" to God in prayer?
3. Which of the eight qualities in verse 8 is hardest for you to dwell on — and why?`,
  },
  {
    title: 'Chosen Before the Foundation: Identity in Ephesians 1',
    slug: 'chosen-before-the-foundation',
    summary:
      'One Greek sentence runs from verse 3 to verse 14. Paul stacks blessing on blessing to answer the question that defines a generation: who am I?',
    formatType: 'comprehensive',
    translation: 'BSB',
    categoryId: 10,
    isFeatured: true,
    tags: ['Identity', 'Ephesians', 'Adoption', 'Grace'],
    daysAgo: 5,
    markdown: `# Chosen Before the Foundation

## Introduction

Ephesians 1:3-14 is, in the Greek, a single unbroken sentence — over 200 words, one clause tumbling into the next. Paul is doing something rhetorical: he is refusing to let the reader pause, piling up one clause of blessing after another, until the question *who am I?* is answered not with a definition but with a doxology.

> *"Blessed be the God and Father of our Lord Jesus Christ, who has blessed us in Christ with every spiritual blessing in the heavenly realms."* — Ephesians 1:3 (BSB)

## The Pattern: "In Christ"

Paul uses the phrase **ἐν Χριστῷ (en Christō)** — "in Christ" — eleven times in this one sentence. Identity, in Paul's frame, is not something you assemble from the inside out. It is a location. You are *in* someone.

## Chosen and Adopted

> *"For He chose us in Him before the foundation of the world, to be holy and blameless in His presence. In love He predestined us for adoption as His sons through Jesus Christ."* — Ephesians 1:4-5 (BSB)

### A Note on υἱοθεσία (huiothesia, G5206)

The word translated *adoption* is a legal term from Roman culture. In the first century, an adopted son had a stronger legal claim than a biological one — adoption could not be undone, while biological heirs could be disinherited. Paul chose a word that meant *permanent* in the courts his readers knew.

## Sealed with the Spirit

> *"And in Him, having heard and believed the word of truth — the gospel of your salvation — you were sealed with the promised Holy Spirit, who is the pledge of our inheritance."* — Ephesians 1:13-14 (BSB)

**σφραγίζω (sphragizō, G4972)** — "to seal, to mark with a signet." In commerce, a seal marked ownership and authenticity. Paul applies it to the Spirit: the Christian is marked as belonging to God, and that mark is itself a down payment on everything still to come.

## Identity Is Received, Not Constructed

Every verb in this passage is passive or divine. *Chose us. Predestined us. Adopted us. Lavished on us. Made known to us. Sealed us.* Nothing in Paul's list of the Christian's identity is something the Christian did.

## Questions for Reflection

1. Where do you most often look for your identity — achievement, relationships, aesthetic, ideology?
2. What would change about your day if you genuinely believed you were *chosen before the foundation of the world*?
3. Paul says the Spirit is a *pledge* (ἀρραβών) — a down payment. What does it mean that your present experience of God is only the first installment?`,
  },
  {
    title: 'A Living Sacrifice: Calling in Romans 12',
    slug: 'a-living-sacrifice',
    summary:
      'Not a verse about life plans, but a passage about a life surrendered. Paul redefines "calling" through the body, the mind, and the gifts.',
    formatType: 'quick',
    translation: 'BSB',
    categoryId: 3,
    isFeatured: false,
    tags: ['Calling', 'Romans', 'Gifts'],
    daysAgo: 11,
    markdown: `# A Living Sacrifice

## Introduction

"What am I supposed to do with my life?" is the defining question of the quarter-life decade. The Christian tradition has a text for it, and it is not Jeremiah 29:11 — which in context is a letter to Babylonian exiles about a 70-year captivity, not a personal life plan. The text is Romans 12:1-8, where Paul, having spent eleven chapters on what God has done, finally turns to what the Christian does in response.

> *"Therefore I urge you, brothers, on account of the mercies of God, to offer your bodies as living sacrifices, holy and pleasing to God, which is your spiritual service of worship."* — Romans 12:1 (BSB)

## The Logic of *Therefore*

The word **οὖν (oun)** — "therefore" — is doing heavy lifting. Paul has built eleven chapters of argument: justification, grace, the Spirit, election, the gospel to Jew and Gentile. *Therefore.* Everything that follows is a response, not a prerequisite.

Calling, in this frame, starts downstream of the gospel. Not: *find your purpose and then live for God.* Rather: *you have received mercy, therefore offer yourself.*

## A Renewed Mind

> *"Do not be conformed to this world, but be transformed by the renewing of your mind, so that you may prove what is the good, pleasing, and perfect will of God."* — Romans 12:2 (BSB)

**μεταμορφόω (metamorphoō, G3339)** — "to transform, to be changed in form." The same verb appears at the Transfiguration. Paul uses a present passive imperative: *keep being transformed.* Calling is discovered by becoming, not by deciding.

## Gifts That Differ

> *"We have different gifts, according to the grace given us. If a man's gift is prophesying, let him use it in proportion to his faith..."* — Romans 12:6 (BSB)

Paul does not give a personality test. He gives a posture: whatever you have been given, use it in proportion, in the body. The question is not *what is my unique calling?* but *what has grace given me, and am I using it for the whole?*

## Questions for Reflection

1. What have you treated as a prerequisite to God's acceptance that Paul treats as a response to it?
2. Where is your mind being *conformed* rather than *transformed* right now?
3. What gift has been given to you — and who is it for?`,
  },
  {
    title: 'At the Threshing Floor: Dating, Covenant, and the Book of Ruth',
    slug: 'at-the-threshing-floor',
    summary:
      'A foreign widow, a near-kinsman, and a midnight conversation. Ruth 2-4 reframes romance as covenant and risk as faith.',
    formatType: 'standard',
    translation: 'BSB',
    categoryId: 4,
    isFeatured: false,
    tags: ['Ruth', 'Covenant', 'Dating', 'Redemption'],
    daysAgo: 14,
    markdown: `# At the Threshing Floor

## Introduction

The book of Ruth is four chapters of quiet, domestic Hebrew narrative set against a noisy national backdrop: *"In the days when the judges ruled..."* — a period Judges itself summarizes as *everyone did what was right in his own eyes.* Against that chaos, Ruth tells a love story that is almost entirely built on keeping one's word.

> *"Wherever you go, I will go, and wherever you live, I will live. Your people will be my people, and your God will be my God."* — Ruth 1:16 (BSB)

## Gleaning and Notice

In chapter 2, Ruth — a Moabite widow in Israel — goes to glean in a field that *"happened"* to belong to Boaz, a kinsman of her late father-in-law. The narrator's deadpan "happened" (Heb. *miqreh*) is the book's dry joke: nothing in Ruth is accidental.

Boaz notices her. But what he says is not flirtation; it is a blessing.

> *"May the LORD repay your work, and may you receive a full reward from the LORD, the God of Israel, under whose wings you have come to take refuge."* — Ruth 2:12 (BSB)

## The Threshing Floor

Chapter 3 is the book's narrative hinge. At Naomi's direction, Ruth goes to the threshing floor at night and uncovers Boaz's feet. The scene is charged — ancient readers would have recognized the sexual tension — but what happens is the opposite of the chaos of Judges. Ruth asks Boaz to act as a **גֹּאֵל (go'el)**, a kinsman-redeemer.

> *"I am Ruth your servant. Spread the corner of your garment over me, for you are a kinsman-redeemer."* — Ruth 3:9 (BSB)

### A Note on חֶסֶד (ḥesed, H2617)

Boaz responds by calling her *ḥesed* — "covenant loyalty, steadfast love" — greater than her first. *Ḥesed* is the defining word of the book. It is love that keeps its word when it would cost less to walk away.

## The Transaction at the Gate

Chapter 4 is a legal scene: Boaz sits at the city gate with ten elders and transacts Ruth's redemption publicly. Romance, in Ruth, ends in the most unromantic place imaginable — a courtroom — because covenant is what makes love durable.

## Questions for Reflection

1. Where is your instinct to treat love as feeling rather than as covenant?
2. What would *ḥesed* look like in the specific relationship that's on your mind right now?
3. Why does the book insist on staging the climactic love scene at a legal proceeding?`,
  },
  {
    title: 'How Long, O LORD: Habakkuk and Honest Doubt',
    slug: 'how-long-o-lord',
    summary:
      'A minor prophet who argues with God for two chapters and ends in a hymn. A study in faith that is allowed to complain.',
    formatType: 'comprehensive',
    translation: 'KJV',
    categoryId: 7,
    isFeatured: true,
    tags: ['Habakkuk', 'Doubt', 'Lament', 'Faith'],
    daysAgo: 20,
    markdown: `# How Long, O LORD

## Introduction

Habakkuk is short — three chapters — and structurally unlike any other prophetic book. Most prophets speak *to* the people on God's behalf. Habakkuk speaks *to God* on the people's behalf, and what he says is a complaint. The book is a conversation in which the prophet is allowed to argue, and God does not rebuke him for arguing.

For a generation that has been told its doubts are a failure of faith, Habakkuk is an unexpected text: the Bible includes a book whose first act is the prophet saying *this is not acceptable.*

> *"O LORD, how long shall I cry, and thou wilt not hear! even cry out unto thee of violence, and thou wilt not save!"* — Habakkuk 1:2 (KJV)

## Complaint One: Why the Silence?

Habakkuk's first complaint is about God's apparent inaction. The prophet sees violence and injustice in Judah and cries out. God is silent. Habakkuk does not pretend otherwise.

God answers — and the answer is harder than the silence. He is raising up the Babylonians, a more violent people, to discipline Judah.

## Complaint Two: Why the Wrong Tool?

> *"Art thou not from everlasting, O LORD my God, mine Holy One? we shall not die. O LORD, thou hast ordained them for judgment... Thou art of purer eyes than to behold evil, and canst not look on iniquity: wherefore lookest thou upon them that deal treacherously, and holdest thy tongue when the wicked devoureth the man that is more righteous than he?"* — Habakkuk 1:12-13 (KJV)

The second complaint is sharper. If God is holy, how can He use a worse people to judge a bad one? Habakkuk does not retract. He posts himself on the watchtower and waits.

> *"I will stand upon my watch, and set me upon the tower, and will watch to see what he will say unto me, and what I shall answer when I am reproved."* — Habakkuk 2:1 (KJV)

## The Answer: The Just Shall Live by Faith

God answers with a vision — not an explanation. The proud will fall; the just will live by faith.

> *"Behold, his soul which is lifted up is not upright in him: but the just shall live by his faith."* — Habakkuk 2:4 (KJV)

Paul quotes this line in Romans and Galatians; the Reformation pivoted on it. What is easy to miss is its original context: it is an answer to a complaint. *Faith*, in Habakkuk, means staying at your post while the answer is still on its way.

## The Hymn of Chapter 3

Chapter 3 is a psalm. The prophet who began in complaint ends in a hymn he knows will be sung in worship — complete with musical notation ("Shigionoth," "to the chief singer on my stringed instruments").

> *"Although the fig tree shall not blossom, neither shall fruit be in the vines... yet I will rejoice in the LORD, I will joy in the God of my salvation."* — Habakkuk 3:17-18 (KJV)

The resolution is not *I now understand.* It is *I will rejoice even without understanding.* The doubt is not dissolved; it is held inside a larger trust.

## Questions for Reflection

1. What is your *first complaint* to God right now — the one you have stopped voicing because you are not sure you're allowed?
2. Habakkuk stays at his post. What does "staying at your post" look like in a season where God seems silent?
3. Chapter 3 is sung in worship *with* the complaints of chapters 1-2 preserved. What does that say about the kind of worship the Bible considers honest?`,
  },
  {
    title: 'Treasure and Worry: Jesus on Money in Matthew 6',
    slug: 'treasure-and-worry',
    summary:
      'The Sermon on the Mount connects money and anxiety in a way that is hard to hear and harder to forget. A close read of Matthew 6:19-34.',
    formatType: 'standard',
    translation: 'BSB',
    categoryId: 9,
    isFeatured: false,
    tags: ['Money', 'Anxiety', 'Matthew', 'Provision'],
    daysAgo: 25,
    markdown: `# Treasure and Worry

## Introduction

Matthew 6:19-34 is a single argument in three movements: where your treasure is (v.19-24), what anxiety does (v.25-32), and what to seek instead (v.33-34). Jesus treats money and worry as the same problem viewed from two sides.

> *"Do not store up for yourselves treasures on earth, where moth and rust destroy, and where thieves break in and steal. But store up for yourselves treasures in heaven."* — Matthew 6:19-20 (BSB)

## The Eye and the Master

Between the treasure saying and the anxiety saying, Jesus puts two images: the eye as a lamp, and two masters.

> *"No one can serve two masters... You cannot serve both God and money."* — Matthew 6:24 (BSB)

**μαμωνᾶς (mamōnas, G3126)** — "mammon" — is an Aramaic loan-word for wealth, treated by Jesus almost as a proper name. Money here is not a neutral tool; it is a rival allegiance.

## Worry as Theology

> *"Therefore I tell you, do not worry about your life, what you will eat or drink, or about your body, what you will wear. Is not life more than food, and the body more than clothes?"* — Matthew 6:25 (BSB)

Jesus diagnoses worry as a claim about God. To worry about provision is to act as if provision is our problem to solve. His argument is empirical — birds, lilies — and then theological: *your heavenly Father knows that you need them.*

### A Note on μεριμνάω (merimnaō, G3309)

The same Greek verb Paul uses in Philippians 4:6 appears six times in this passage. "Worry" here is not emotion — it is a divided mind, pulled between trusting God and trying to secure yourself.

## Seek First

> *"But seek first the kingdom of God and His righteousness, and all these things will be added unto you."* — Matthew 6:33 (BSB)

The verb **ζητέω (zēteō, G2212)** is present imperative — "keep seeking." Jesus is not promising that faith exempts you from needing food or rent. He is reordering priority: kingdom first, and the rest is downstream.

## Questions for Reflection

1. Where is your *treasure* actually stored — in what does your sense of security live?
2. Jesus frames worry as a theology problem, not a feelings problem. What does that reframe change?
3. What would "seek first the kingdom" mean in the specific financial decision that is on your mind right now?`,
  },
  {
    title: 'Before Daybreak: Focus and Solitude in a Distracted Age',
    slug: 'before-daybreak',
    summary:
      'Mark 1:35-39. The busiest day of Jesus\' early ministry is followed by His withdrawal to pray before dawn. A study in solitude for a distracted age.',
    formatType: 'quick',
    translation: 'WEB',
    categoryId: 9,
    isFeatured: false,
    tags: ['Solitude', 'Mark', 'Prayer', 'Discipline'],
    daysAgo: 29,
    markdown: `# Before Daybreak

## Introduction

Mark's gospel moves fast. Chapter 1 alone contains Jesus' baptism, temptation, the calling of the first disciples, a demon-possessed man healed in the synagogue, Simon's mother-in-law healed, and — by sundown — *"the whole city"* gathered at the door. And then, right in the middle of the momentum, Mark slows down.

> *"Early in the morning, while it was still dark, he rose up and went out, and departed into a deserted place, and prayed there."* — Mark 1:35 (WEB)

## The Structure of the Day

Mark frames the withdrawal with what came before and what came after:

- **The night before (1:32-34):** the whole city at the door; Jesus heals many and casts out demons.
- **Before daybreak (1:35):** Jesus goes out alone to pray.
- **The next move (1:36-38):** the disciples find Him and say *everyone is looking for you.* Jesus replies, *let us go elsewhere to the nearby villages, so that I may preach there too. For that is why I came.*

The solitude is not an escape from ministry. It is what lets Him re-aim.

## A Note on the Greek

Mark uses three modifiers stacked: ἔννυχα λίαν (*very early, while still night*), ἀναστάς (*having risen*), ἐξῆλθεν (*went out*), ἀπῆλθεν (*departed*). The verbs pile up because the action is costly — Jesus gave up rest, comfort, and proximity to do this.

## Crowds and Clarity

The disciples' report — *everyone is looking for you* — is the modern condition in one sentence. The pressure to respond to everything and everyone is not new. What is new is that we carry it in our pockets.

Jesus' answer is not *tell them I'll be there soon.* It is a re-direction: He leaves the town where the demand is highest to go to the villages that have not yet heard. Solitude gave Him clarity about where to go next.

## Questions for Reflection

1. When, in the rhythm of your week, do you let yourself be unreachable?
2. What demand is loudest right now, and whose voice is it?
3. Jesus used solitude to re-aim, not to recover. What would re-aiming in prayer look like for you this week?`,
  },
  {
    title: 'Do Justice, Love Mercy: Micah 6:8 in Context',
    slug: 'do-justice-love-mercy',
    summary:
      'The most-quoted verse from the Minor Prophets sits inside a courtroom scene. Reading Micah 6:8 with the lawsuit around it.',
    formatType: 'comprehensive',
    translation: 'BSB',
    categoryId: 7,
    isFeatured: false,
    tags: ['Justice', 'Micah', 'Mercy', 'Prophets'],
    daysAgo: 35,
    markdown: `# Do Justice, Love Mercy

## Introduction

Micah 6:8 is one of the most quoted verses in the Hebrew Bible. It is also one of the most decontextualized. Pulled from its setting, it reads like a values statement. In context, it is the verdict in a courtroom scene — and the courtroom is God's.

> *"He has shown you, O man, what is good. And what does the LORD require of you but to act justly, to love mercy, and to walk humbly with your God?"* — Micah 6:8 (BSB)

## The Lawsuit

Micah 6 opens with God convening a court. The mountains are the jury. Israel is the defendant. The charge: covenant unfaithfulness.

> *"Hear now what the LORD says: 'Arise, plead your case before the mountains, and let the hills hear your voice.'"* — Micah 6:1 (BSB)

Verse 8 is the prophet's answer to Israel's defense. Israel has asked: *what does God want? Bigger burnt offerings? Thousands of rams? My firstborn?* The prophet's reply cuts through the escalating price list — God has already told you.

## Three Verbs

The verse contains three Hebrew commands. Each is a verb, not a noun — *doing*, not *having*.

### עֲשׂוֹת מִשְׁפָּט (asot mishpat) — *do justice*

**מִשְׁפָּט (mishpat, H4941)** means *legal right, rectifying judgment.* It is not a disposition; it is an act. In the Torah it is what you do for the widow, the orphan, the immigrant, the poor person without legal standing. To *do mishpat* is to give people what is rightly theirs — especially when the system is refusing to.

### אַהֲבַת חֶסֶד (ahavat ḥesed) — *love mercy*

**חֶסֶד (ḥesed, H2617)** is the same word that dominates Ruth. It is covenant loyalty — love that keeps its word. Here it is paired with *ahav* (to love), making the object inseparable from the disposition. You cannot do *ḥesed* grudgingly; the verb refuses it.

### הַצְנֵעַ לֶכֶת (hatsne'a lekhet) — *walk humbly*

The verb is from **צָנַע (tsana', H6800)** — "to be modest, to go circumspectly." This is not self-deprecation; it is the quiet walk of a person who knows the size of the God they are walking with.

## Why the Order Matters

Justice first, mercy second, humility third. The order resists two distortions:

- **Private piety without justice:** humility without *mishpat* is the religion Micah 6:6-7 mocks — bigger and bigger offerings while the poor are ground down.
- **Activism without humility:** *mishpat* and *ḥesed* without a humble walk become self-righteous and finally tyrannical.

The three hold each other together.

## Questions for Reflection

1. Which of the three commands — justice, mercy, humility — does your tradition or your feed over-emphasize? Which does it under-emphasize?
2. Micah frames this as a *verdict* in a courtroom, not a lifestyle tip. How does that change the stakes?
3. Where is there a *mishpat* situation in your actual life — someone being denied what is rightly theirs — that you could act on this week?`,
  },
  {
    title: 'Two Are Better Than One: Friendship in Ecclesiastes 4',
    slug: 'two-are-better-than-one',
    summary:
      'The Teacher surveys isolation and declares it vanity. A short wisdom passage on friendship, partnership, and the threefold cord.',
    formatType: 'standard',
    translation: 'BSB',
    categoryId: 8,
    isFeatured: false,
    tags: ['Friendship', 'Ecclesiastes', 'Loneliness', 'Wisdom'],
    daysAgo: 41,
    markdown: `# Two Are Better Than One

## Introduction

Ecclesiastes is a book of disillusionment. The Teacher — Qoheleth — surveys every source of human meaning and declares most of them *hevel* (vapor, breath, vanity). And yet the book is not nihilistic. In the middle of chapter 4, the Teacher lands on something he refuses to call vanity: companionship.

> *"Two are better than one, because they have a good return for their labor."* — Ecclesiastes 4:9 (BSB)

## The Isolated Man

The passage begins with a portrait the Teacher finds unbearable:

> *"There is one all alone, without a companion. He has neither son nor brother. There is no end to his labor, yet his eyes are not satisfied with wealth: 'For whom do I toil and deprive myself of enjoyment?' This too is futile — a miserable task."* — Ecclesiastes 4:8 (BSB)

The picture is striking. A man with no shortage of work, no shortage of income, no shortage of accomplishment — and no one. The Teacher calls it *hevel*. Modernity has a newer word for it: loneliness.

## Four Arguments for Company

Verses 9-12 give four concrete reasons two are better than one:

1. **Return on labor.** *"They have a good return for their labor."* Work done together multiplies.
2. **Rescue when you fall.** *"If one falls down, his friend can help him up. But pity the one who falls without another to help him up."*
3. **Warmth.** *"If two lie down together, they will keep warm. But how can one keep warm alone?"*
4. **Defense.** *"Though one may be overpowered, two can resist."*

Each image is practical, almost utilitarian — and deliberately so. The Teacher is not sentimental about friendship. He is making an argument from observation.

## The Threefold Cord

> *"A cord of three strands is not quickly broken."* — Ecclesiastes 4:12 (BSB)

The image is from rope-making. A single strand snaps; two twisted together hold; three are nearly unbreakable. Jewish tradition has often read the third strand as God Himself — the unseen presence binding two friends together. The text does not require that reading, but it invites it: the Teacher who has called almost everything *hevel* is unwilling to call faithful company vain.

## Reading in Context

Chapter 4 begins with the Teacher observing oppression and finding no comforter (v.1). It ends with the reflection on friendship. The structure is deliberate: the answer to a world where no one comforts is not more achievement but the presence of a faithful other.

## Questions for Reflection

1. The Teacher condemns *isolated achievement* as vanity. Where in your life are you tempted to trade friendship for accomplishment?
2. Which of the four practical benefits — labor, rescue, warmth, defense — are you currently missing, and which are you currently giving?
3. Who is your threefold cord — the friendship that has God as its third strand?`,
  },
  {
    title: 'New Every Morning: Grief, Lament, and Lamentations 3',
    slug: 'new-every-morning',
    summary:
      'One of the Bible\'s most quoted promises sits at the exact center of its bleakest book. A study in lament that makes room for hope.',
    formatType: 'quick',
    translation: 'KJV',
    categoryId: 1,
    isFeatured: false,
    tags: ['Lament', 'Lamentations', 'Hope', 'Suffering'],
    daysAgo: 48,
    markdown: `# New Every Morning

## Introduction

Lamentations is a book written after the fall of Jerusalem in 586 BC. The city has been burned, the temple destroyed, the population deported. The book's five chapters are five acrostic poems — each one marching through the Hebrew alphabet, as if the poet is trying to hold grief together by form alone. Chapter 3 is the longest, the densest, and structurally the center.

And at the exact middle of the book, in the middle of its most anguished poem, sits one of the most quoted promises in Scripture.

> *"It is of the LORD'S mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness."* — Lamentations 3:22-23 (KJV)

## What Surrounds the Promise

The verses before 3:22 are relentless. The poet describes being hunted, walled in, his prayers shut out, his teeth broken on gravel, his soul bereft of peace. He has *forgotten what happiness is.*

> *"And I said, My strength and my hope is perished from the LORD."* — Lamentations 3:18 (KJV)

And then, without transition, verse 21:

> *"This I recall to my mind, therefore have I hope."* — Lamentations 3:21 (KJV)

The pivot is on the verb *recall*. Hope, in Lamentations, is not a feeling that arrives; it is a thing the griever deliberately pulls back into mind.

## Compassions New Every Morning

**חֶסֶד (ḥesed, H2617)** appears again — the covenant-love word that ran through Ruth and Micah. Here it is plural (*chasadim*), *mercies*, *steadfast loves*. The poet is not saying God's love was enough once. He is saying it arrives in a new portion with each sunrise.

## Lament That Makes Room for Hope

Lamentations does not resolve. The book ends on a note of unresolved plea: *"Wherefore dost thou forget us for ever... unless thou hast utterly rejected us."* The hope of chapter 3 does not erase the grief of chapters 1, 2, 4, and 5. They sit together.

That is the book's gift. It refuses to make grief illegitimate in the presence of hope, or hope impossible in the presence of grief. Both are true. Both get pages.

## Questions for Reflection

1. What is the grief you have been trying to get past, that Lamentations would invite you to sit inside?
2. The poet *recalls to mind* in order to hope. What do you need to deliberately bring back to mind this week?
3. What does it mean that the most quoted hope-verse in Scripture sits in the middle of its most anguished poem?`,
  },
];

function slugExists(slug: string): boolean {
  const row = db.prepare('SELECT 1 FROM studies WHERE slug = ?').get(slug);
  return Boolean(row);
}

function insertStudy(study: SeedStudy): number {
  const createdAt = new Date(Date.now() - study.daysAgo * 86_400_000).toISOString();

  const insert = db.prepare(`
    INSERT INTO studies (
      title, slug, content_markdown, summary, format_type, translation_used,
      current_translation, original_content, is_public, is_featured,
      created_by, category_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    study.title,
    study.slug,
    study.markdown,
    study.summary,
    study.formatType,
    study.translation,
    study.translation,
    study.markdown,
    study.isFeatured ? 1 : 0,
    SEED_USER_ID,
    study.categoryId,
    createdAt,
    createdAt,
  );

  return Number(result.lastInsertRowid);
}

function insertTags(studyId: number, tags: string[]): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO study_tags (study_id, tag_name) VALUES (?, ?)',
  );
  for (const tag of tags) {
    insert.run(studyId, tag);
  }
}

function main() {
  const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(SEED_USER_ID);
  if (!userRow) {
    console.error(`Seed user id=${SEED_USER_ID} not found. Aborting.`);
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  const tx = db.transaction(() => {
    for (const study of STUDIES) {
      if (slugExists(study.slug)) {
        console.log(`  skip  ${study.slug} (already exists)`);
        skipped++;
        continue;
      }
      const id = insertStudy(study);
      insertTags(id, study.tags);
      console.log(`  add   ${study.slug} (id=${id}, ${study.formatType}, ${study.translation})`);
      inserted++;
    }
  });

  tx();

  console.log(`\nDone. Inserted: ${inserted}  Skipped: ${skipped}  Total seeds: ${STUDIES.length}`);
}

main();
