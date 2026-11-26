// Every word the lesson shows, in English (the main language) and Greek (for the Greek-speaking classes who
// asked for this lesson). The Greek was written for this project: have a Greek speaker check it before use.
// Facts follow the Hiroshima Peace Memorial Museum and the City of Hiroshima's own accounts.

/** The five moments of the lesson, in order. */
export const ERAS = ['before', 'blast', 'after', 'rebuilt', 'today'];

export const ERA = {
  before: {
    en: { label: 'Morning, 1945', title: 'Hiroshima, 6 August 1945, 8:00', text: 'A clear, hot summer morning. An air-raid warning ended at 7:31, and the city went about its day: trams crossing the bridge, shops opening, students at work in the streets. Walk around, and point at any ⓘ to find out more.' },
    el: { label: 'Πρωί, 1945', title: 'Χιροσίμα, 6 Αυγούστου 1945, 8:00', text: 'Ένα καθαρό, ζεστό καλοκαιρινό πρωί. Ο συναγερμός αεροπορικής επιδρομής έληξε στις 7:31 και η πόλη συνέχισε τη μέρα της: τραμ περνούν τη γέφυρα, τα μαγαζιά ανοίγουν, μαθητές δουλεύουν στους δρόμους. Περπατήστε τριγύρω και δείξτε οποιοδήποτε ⓘ για να μάθετε περισσότερα.' },
  },
  blast: {
    en: { label: '8:15', title: '8:15', text: 'Stay where you are and watch. A bright flash and loud sounds follow.' },
    el: { label: '8:15', title: '8:15', text: 'Μείνετε όπου βρίσκεστε και παρακολουθήστε. Ακολουθούν μια έντονη λάμψη και δυνατοί ήχοι.' },
  },
  after: {
    en: { label: 'After the Bomb', title: 'The Same Afternoon', text: 'Almost everything within two kilometres is destroyed, and fires burn across the city. The hall by the river is still standing. Point at any ⓘ to find out more.' },
    el: { label: 'Μετά τη Βόμβα', title: 'Το Ίδιο Απόγευμα', text: 'Σχεδόν τα πάντα σε ακτίνα δύο χιλιομέτρων έχουν καταστραφεί και φωτιές καίνε σε όλη την πόλη. Το κτίριο δίπλα στο ποτάμι στέκεται ακόμη. Δείξτε οποιοδήποτε ⓘ για να μάθετε περισσότερα.' },
  },
  rebuilt: {
    en: { label: 'Rebuilt, 1958', title: 'Hiroshima, 1958', text: 'Thirteen years later the city has been rebuilt as a City of Peace, and the busy district on the island has become the Peace Memorial Park. Many survivors still live with the bomb every day. This is the world of The Flowers of Hiroshima.' },
    el: { label: 'Ανοικοδόμηση, 1958', title: 'Χιροσίμα, 1958', text: 'Δεκατρία χρόνια αργότερα η πόλη έχει ξαναχτιστεί ως Πόλη της Ειρήνης, και η πολύβουη συνοικία στο νησί έχει γίνει το Πάρκο Μνήμης της Ειρήνης. Πολλοί επιζώντες ζουν ακόμη καθημερινά με τη βόμβα. Αυτός είναι ο κόσμος του βιβλίου «Τα λουλούδια της Χιροσίμα».' },
  },
  today: {
    en: { label: 'Today', title: 'Hiroshima Today', text: 'A city of more than a million people. The ruined hall, now the Atomic Bomb Dome, is kept exactly as the bomb left it. Leave a paper crane at the Children’s Peace Monument, or ring the Peace Bell.' },
    el: { label: 'Σήμερα', title: 'Η Χιροσίμα Σήμερα', text: 'Μια πόλη με περισσότερους από ένα εκατομμύριο κατοίκους. Το κατεστραμμένο κτίριο, σήμερα ο Θόλος της Ατομικής Βόμβας, διατηρείται ακριβώς όπως το άφησε η βόμβα. Αφήστε έναν χάρτινο γερανό στο Μνημείο Ειρήνης των Παιδιών ή χτυπήστε την Καμπάνα της Ειρήνης.' },
  },
};

/**
 * The ⓘ markers: where they stand (x, y, z in metres; see src/world/layout.js), in which moments they show, and
 * their text. `look` is where the "go to" button turns you to face.
 */
export const MARKERS = [
  // ── the morning of 6 August 1945 ──
  { id: 'hall', eras: ['before'], at: [8, 30, 4], view: { pos: [-8, 0, -34], look: [10, 12, 8] },
    en: { title: 'Industrial Promotion Hall', kind: 'Exhibition hall, 1915', facts: ['Designed by the Czech architect Jan Letzel and finished in 1915, it showed and sold products made in Hiroshima Prefecture, and held art exhibitions.', 'Its green copper dome was one of the best-known sights in the city.', 'By 1945 it was used as government offices.'] },
    el: { title: 'Μέγαρο Προώθησης Βιομηχανίας', kind: 'Εκθεσιακό κτίριο, 1915', facts: ['Το σχεδίασε ο Τσέχος αρχιτέκτονας Γιαν Λέτζελ και ολοκληρώθηκε το 1915. Εκεί εκτίθεντο και πωλούνταν προϊόντα του νομού της Χιροσίμα και γίνονταν εκθέσεις τέχνης.', 'Ο πράσινος χάλκινος θόλος του ήταν ένα από τα πιο γνωστά αξιοθέατα της πόλης.', 'Το 1945 στέγαζε κυβερνητικά γραφεία.'] } },
  { id: 'bridge', eras: ['before'], at: [-110, 5, -78], view: { pos: [-60, 0, -66], look: [-130, 2, -78] },
    en: { title: 'Aioi Bridge', kind: 'Bridge, 1932', facts: ['The bridge crosses the river where it divides in two, and has a third arm reaching the island: from above it looks like the letter T.', 'That shape was easy to recognise from the air, so it was chosen as the bomb’s aiming point.', 'Trams crossed it all day.'] },
    el: { title: 'Γέφυρα Αϊόι', kind: 'Γέφυρα, 1932', facts: ['Η γέφυρα διασχίζει το ποτάμι εκεί όπου χωρίζεται στα δύο και έχει ένα τρίτο σκέλος προς το νησί: από ψηλά μοιάζει με το γράμμα Τ.', 'Αυτό το σχήμα αναγνωριζόταν εύκολα από αέρος, γι’ αυτό επιλέχθηκε ως σημείο στόχευσης της βόμβας.', 'Τα τραμ τη διέσχιζαν όλη μέρα.'] } },
  { id: 'city', eras: ['before'], at: [40, 9, -30], view: { pos: [22, 0, -48], look: [60, 3, -10] },
    en: { title: 'The City', kind: 'About 350,000 people', facts: ['Most homes and shops were wooden, with tiled roofs, built close together along narrow streets.', 'To stop fires spreading in air raids, houses were being pulled down to make firebreaks. Thousands of secondary school students were working on them in the city centre that morning.', 'Many younger children had been sent to the countryside for safety.'] },
    el: { title: 'Η Πόλη', kind: 'Περίπου 350.000 άνθρωποι', facts: ['Τα περισσότερα σπίτια και μαγαζιά ήταν ξύλινα, με κεραμοσκεπές, χτισμένα το ένα δίπλα στο άλλο σε στενούς δρόμους.', 'Για να μην εξαπλώνονται οι φωτιές στους βομβαρδισμούς, γκρέμιζαν σπίτια για να ανοίξουν αντιπυρικές ζώνες. Χιλιάδες μαθητές γυμνασίου δούλευαν σε αυτές στο κέντρο της πόλης εκείνο το πρωί.', 'Πολλά μικρότερα παιδιά είχαν σταλεί στην ύπαιθρο για ασφάλεια.'] } },
  { id: 'tram', eras: ['before'], at: [-40, 5, -78], view: { pos: [-20, 0, -66], look: [-50, 2, -78] },
    en: { title: 'The Trams', kind: 'Hiroshima Electric Railway', facts: ['Streetcars ran through the centre and across the Aioi Bridge.', 'With so many men away at the war, teenage girls trained at the railway’s own school to drive and conduct the trams.'] },
    el: { title: 'Τα Τραμ', kind: 'Ηλεκτρικός Σιδηρόδρομος Χιροσίμα', facts: ['Τα τραμ διέσχιζαν το κέντρο και περνούσαν από τη Γέφυρα Αϊόι.', 'Επειδή πολλοί άνδρες βρίσκονταν στον πόλεμο, έφηβα κορίτσια εκπαιδεύονταν στη σχολή του σιδηροδρόμου για να οδηγούν τα τραμ και να κόβουν εισιτήρια.'] } },
  { id: 'rivers', eras: ['before'], at: [-50, 3, 40], view: { pos: [-20, 0, 30], look: [-60, -1, 60] },
    en: { title: 'The City of Rivers', kind: 'The Ota River delta', facts: ['Hiroshima is built on the islands of a river delta, where the Ota River divides into several branches on its way to the sea.', 'The island across the river, Nakajima, was one of the busiest shopping districts in the city.'] },
    el: { title: 'Η Πόλη των Ποταμών', kind: 'Το δέλτα του ποταμού Ότα', facts: ['Η Χιροσίμα είναι χτισμένη στα νησιά ενός δέλτα, εκεί όπου ο ποταμός Ότα χωρίζεται σε πολλά σκέλη πριν φτάσει στη θάλασσα.', 'Το νησί απέναντι, η Νακατζίμα, ήταν μία από τις πιο πολυσύχναστες εμπορικές συνοικίες της πόλης.'] } },
  { id: 'shima', eras: ['before'], at: [112, 12, 110], view: { pos: [70, 0, 80], look: [112, 6, 110] },
    en: { title: 'Shima Hospital', kind: 'About 160 metres from the hall', facts: ['A private hospital in a busy street, a short walk from the river.', 'At 8:15 the bomb exploded about 600 metres almost directly above it. This point on the ground is called the hypocentre.'] },
    el: { title: 'Νοσοκομείο Σίμα', kind: 'Περίπου 160 μέτρα από το μέγαρο', facts: ['Ένα ιδιωτικό νοσοκομείο σε έναν πολυσύχναστο δρόμο, κοντά στο ποτάμι.', 'Στις 8:15 η βόμβα εξερράγη περίπου 600 μέτρα σχεδόν ακριβώς από πάνω του. Αυτό το σημείο στο έδαφος λέγεται υπόκεντρο.'] } },

  // ── the afternoon of 6 August 1945 ──
  { id: 'dome-after', eras: ['after'], at: [8, 28, 4], view: { pos: [-8, 0, -34], look: [10, 12, 8] },
    en: { title: 'Why the Hall Still Stands', kind: 'The Industrial Promotion Hall', facts: ['The bomb exploded almost straight above it, so the blast pushed down on the building rather than sideways. Its thick central walls and the steel frame of the dome stayed standing.', 'No one inside survived.'] },
    el: { title: 'Γιατί το Μέγαρο Στέκεται Ακόμη', kind: 'Το Μέγαρο Προώθησης Βιομηχανίας', facts: ['Η βόμβα εξερράγη σχεδόν ακριβώς από πάνω του, οπότε το ωστικό κύμα πίεσε το κτίριο προς τα κάτω και όχι στο πλάι. Οι χοντροί κεντρικοί τοίχοι και ο χαλύβδινος σκελετός του θόλου έμειναν όρθιοι.', 'Κανείς από όσους βρίσκονταν μέσα δεν επέζησε.'] } },
  { id: 'toll', eras: ['after'], at: [40, 6, -30], view: { pos: [22, 0, -48], look: [60, 2, -10] },
    en: { title: 'The Cost', kind: 'Lives lost', facts: ['About 70,000 people died on the day of the bombing.', 'By the end of 1945, injuries, burns and radiation had raised the number to about 140,000.'] },
    el: { title: 'Το Κόστος', kind: 'Ανθρώπινες ζωές', facts: ['Περίπου 70.000 άνθρωποι πέθαναν την ημέρα του βομβαρδισμού.', 'Ως το τέλος του 1945, τα τραύματα, τα εγκαύματα και η ακτινοβολία είχαν ανεβάσει τον αριθμό σε περίπου 140.000.'] } },
  { id: 'fires', eras: ['after'], at: [80, 8, 60], view: { pos: [40, 0, 30], look: [90, 5, 70] },
    en: { title: 'Fires and Black Rain', kind: 'The hours after', facts: ['The heat set the wooden city alight, and fires burned until the evening.', 'About 20 to 30 minutes after the explosion, a black, sticky rain began to fall, full of soot and radioactive dust.'] },
    el: { title: 'Φωτιές και Μαύρη Βροχή', kind: 'Οι ώρες που ακολούθησαν', facts: ['Η θερμότητα έβαλε φωτιά στην ξύλινη πόλη και οι πυρκαγιές έκαιγαν ως το βράδυ.', 'Περίπου 20 με 30 λεπτά μετά την έκρηξη άρχισε να πέφτει μια μαύρη, κολλώδης βροχή, γεμάτη αιθάλη και ραδιενεργή σκόνη.'] } },
  { id: 'hibakusha', eras: ['after'], at: [-40, 5, -78], view: { pos: [-20, 0, -66], look: [-50, 2, -78] },
    en: { title: 'Hibakusha', kind: 'The survivors', facts: ['Survivors of the bombing are called hibakusha: people affected by the bomb.', 'Many who seemed unhurt fell ill weeks, months or years later, from the radiation.'] },
    el: { title: 'Χιμπακούσα', kind: 'Οι επιζώντες', facts: ['Οι επιζώντες του βομβαρδισμού ονομάζονται χιμπακούσα: οι άνθρωποι που επλήγησαν από τη βόμβα.', 'Πολλοί που φαίνονταν αβλαβείς αρρώστησαν εβδομάδες, μήνες ή χρόνια αργότερα, από την ακτινοβολία.'] } },
  { id: 'trams-again', eras: ['after'], at: [-110, 5, -78], view: { pos: [-60, 0, -66], look: [-130, 2, -78] },
    en: { title: 'Three Days Later', kind: '9 August 1945', facts: ['The Aioi Bridge was damaged but did not fall.', 'Just three days after the bombing, some of the city’s trams were running again: a sign that Hiroshima would not give up.'] },
    el: { title: 'Τρεις Μέρες Αργότερα', kind: '9 Αυγούστου 1945', facts: ['Η Γέφυρα Αϊόι υπέστη ζημιές αλλά δεν κατέρρευσε.', 'Μόλις τρεις μέρες μετά τον βομβαρδισμό, κάποια από τα τραμ της πόλης κυκλοφορούσαν ξανά: ένα σημάδι ότι η Χιροσίμα δεν θα τα παρατούσε.'] } },
  { id: 'growth', eras: ['after'], at: [-50, 3, 40], view: { pos: [-20, 0, 30], look: [-60, 0, 60] },
    en: { title: 'Seventy-Five Years', kind: 'A prediction that was wrong', facts: ['It was said that nothing would grow in Hiroshima for 75 years.', 'Yet that autumn new shoots appeared in the ruins, and the red oleander flowered. It later became the flower of the city.'] },
    el: { title: 'Εβδομήντα Πέντε Χρόνια', kind: 'Μια πρόβλεψη που διαψεύστηκε', facts: ['Λεγόταν ότι τίποτα δεν θα φύτρωνε στη Χιροσίμα για 75 χρόνια.', 'Κι όμως, εκείνο το φθινόπωρο φύτρωσαν νέοι βλαστοί στα ερείπια και η κόκκινη πικροδάφνη άνθισε. Αργότερα έγινε το λουλούδι της πόλης.'] } },

  // ── 1958: the city of the novel ──
  { id: 'park', eras: ['rebuilt', 'today'], at: [-150, 6, 120], view: { pos: [-150, 0, 95], look: [-150, 3, 150] },
    en: { title: 'Peace Memorial Park', kind: 'Designed by Kenzo Tange', facts: ['The park was laid out where the busy Nakajima district had stood.', 'The architect Kenzo Tange lined up its museum, the Cenotaph and the ruined hall across the river along one straight line.', 'The Peace Memorial Museum opened in 1955.'] },
    el: { title: 'Πάρκο Μνήμης της Ειρήνης', kind: 'Σχέδιο του Κένζο Τάνγκε', facts: ['Το πάρκο δημιουργήθηκε εκεί όπου βρισκόταν η πολύβουη συνοικία Νακατζίμα.', 'Ο αρχιτέκτονας Κένζο Τάνγκε έστησε το μουσείο, το Κενοτάφιο και το ερειπωμένο μέγαρο απέναντι στο ποτάμι πάνω σε μία ευθεία γραμμή.', 'Το Μουσείο Μνήμης της Ειρήνης άνοιξε το 1955.'] } },
  { id: 'cenotaph', eras: ['rebuilt', 'today'], at: [-150, 5, 175], view: { pos: [-150, 0, 200], look: [-150, 2, 175] },
    en: { title: 'The Cenotaph', kind: '1952', facts: ['The saddle-shaped arch shelters a stone chest holding the names of those who died, a list that still grows each year.', 'Its words read: “Let all the souls here rest in peace, for we shall not repeat the evil.”', 'Through the arch you can see the ruined hall.'] },
    el: { title: 'Το Κενοτάφιο', kind: '1952', facts: ['Η καμάρα σε σχήμα σέλας προστατεύει μια πέτρινη λάρνακα με τα ονόματα όσων πέθαναν, έναν κατάλογο που μεγαλώνει κάθε χρόνο.', 'Η επιγραφή γράφει: «Ας αναπαυθούν εν ειρήνη όλες οι ψυχές εδώ, γιατί δεν θα επαναλάβουμε το κακό».', 'Μέσα από την καμάρα φαίνεται το ερειπωμένο μέγαρο.'] } },
  { id: 'sadako', eras: ['rebuilt', 'today'], at: [-128, 9, 40], view: { pos: [-128, 0, 58], look: [-128, 4, 40] },
    en: { title: 'Children’s Peace Monument', kind: 'Unveiled on 5 May 1958', facts: ['Sadako Sasaki was two years old when the bomb fell. Ten years later she fell ill with leukaemia, caused by the radiation.', 'In hospital she folded paper cranes: a Japanese tradition says a thousand cranes bring a wish. She died in 1955, aged twelve.', 'Her classmates raised money for this monument to every child who died because of the bomb.'] },
    el: { title: 'Μνημείο Ειρήνης των Παιδιών', kind: 'Αποκαλυπτήρια στις 5 Μαΐου 1958', facts: ['Η Σαντάκο Σασάκι ήταν δύο χρονών όταν έπεσε η βόμβα. Δέκα χρόνια αργότερα αρρώστησε από λευχαιμία, εξαιτίας της ακτινοβολίας.', 'Στο νοσοκομείο δίπλωνε χάρτινους γερανούς: μια ιαπωνική παράδοση λέει ότι χίλιοι γερανοί φέρνουν μια ευχή. Πέθανε το 1955, σε ηλικία δώδεκα ετών.', 'Οι συμμαθητές της μάζεψαν χρήματα για αυτό το μνημείο, αφιερωμένο σε κάθε παιδί που πέθανε εξαιτίας της βόμβας.'] } },
  { id: 'ruin-kept', eras: ['rebuilt'], at: [8, 28, 4], view: { pos: [-60, 0, -10], look: [8, 12, 4] },
    en: { title: 'Keep the Ruin?', kind: 'A question for the city', facts: ['In the 1950s people argued about the ruined hall: some wanted it pulled down because it brought back painful memories, others wanted it kept as a warning.', 'In 1966 the city decided to preserve it for ever.'] },
    el: { title: 'Να Κρατηθεί το Ερείπιο;', kind: 'Ένα ερώτημα για την πόλη', facts: ['Τη δεκαετία του 1950 οι άνθρωποι διαφωνούσαν για το ερειπωμένο μέγαρο: κάποιοι ήθελαν να γκρεμιστεί γιατί ξυπνούσε οδυνηρές μνήμες, άλλοι να διατηρηθεί ως προειδοποίηση.', 'Το 1966 η πόλη αποφάσισε να το διατηρήσει για πάντα.'] } },
  { id: 'survivors-1958', eras: ['rebuilt'], at: [40, 9, -30], view: { pos: [22, 0, -48], look: [60, 3, -10] },
    en: { title: 'Living With the Bomb', kind: 'Thirteen years on', facts: ['Many survivors still lived with scars, burns and illness, and feared what the radiation might do to them or their children.', 'Some kept it secret that they had been in the city that day, afraid they would not find work or be able to marry.'] },
    el: { title: 'Ζώντας με τη Βόμβα', kind: 'Δεκατρία χρόνια μετά', facts: ['Πολλοί επιζώντες ζούσαν ακόμη με ουλές, εγκαύματα και αρρώστιες, και φοβούνταν τι θα μπορούσε να κάνει η ακτινοβολία στους ίδιους ή στα παιδιά τους.', 'Κάποιοι έκρυβαν ότι βρίσκονταν στην πόλη εκείνη τη μέρα, από φόβο ότι δεν θα έβρισκαν δουλειά ή δεν θα μπορούσαν να παντρευτούν.'] } },
  { id: 'city-of-peace', eras: ['rebuilt'], at: [-110, 5, -78], view: { pos: [-60, 0, -66], look: [-130, 2, -78] },
    en: { title: 'A City of Peace', kind: '1949', facts: ['In 1949 a special law, the Hiroshima Peace Memorial City Construction Law, helped pay for the city to be rebuilt.', 'New houses, wider streets and the trams returned, and the city chose to stand for peace.'] },
    el: { title: 'Μια Πόλη της Ειρήνης', kind: '1949', facts: ['Το 1949 ένας ειδικός νόμος, ο Νόμος για την Ανοικοδόμηση της Χιροσίμα ως Πόλης Μνήμης της Ειρήνης, βοήθησε να ξαναχτιστεί η πόλη.', 'Νέα σπίτια, πιο φαρδιοί δρόμοι και τα τραμ επέστρεψαν, και η πόλη επέλεξε να είναι σύμβολο ειρήνης.'] } },
  { id: 'oleander', eras: ['rebuilt', 'today'], at: [-50, 3, 40], view: { pos: [-20, 0, 30], look: [-60, 0, 60] },
    en: { title: 'The Oleander', kind: 'The flower of Hiroshima', facts: ['The red and pink oleander was one of the first plants to flower in the ruins.', 'For the people of Hiroshima it became a sign of hope, and in 1973 it was named the official flower of the city.'] },
    el: { title: 'Η Πικροδάφνη', kind: 'Το λουλούδι της Χιροσίμα', facts: ['Η κόκκινη και ροζ πικροδάφνη ήταν από τα πρώτα φυτά που άνθισαν στα ερείπια.', 'Για τους κατοίκους της Χιροσίμα έγινε σύμβολο ελπίδας και το 1973 ανακηρύχθηκε επίσημο λουλούδι της πόλης.'] } },

  // ── today ──
  { id: 'dome-today', eras: ['today'], at: [8, 28, 4], view: { pos: [-60, 0, -10], look: [8, 12, 4] },
    en: { title: 'Atomic Bomb Dome', kind: 'World Heritage Site since 1996', facts: ['The ruined hall is kept as the bomb left it, held together with hidden steel supports.', 'It was listed by UNESCO in 1996 as a reminder of the destruction caused by nuclear weapons, and of the hope for peace.'] },
    el: { title: 'Θόλος της Ατομικής Βόμβας', kind: 'Μνημείο Παγκόσμιας Κληρονομιάς από το 1996', facts: ['Το ερειπωμένο μέγαρο διατηρείται όπως το άφησε η βόμβα, στηριγμένο με κρυφά χαλύβδινα στηρίγματα.', 'Η UNESCO το ανακήρυξε μνημείο το 1996, ως υπενθύμιση της καταστροφής που προκαλούν τα πυρηνικά όπλα και της ελπίδας για ειρήνη.'] } },
  { id: 'flame', eras: ['today'], at: [-150, 4, 150], view: { pos: [-150, 0, 165], look: [-150, 1.5, 150] },
    en: { title: 'The Flame of Peace', kind: 'Lit in 1964', facts: ['The flame has burned since 1964.', 'It will be put out only when every nuclear weapon on Earth is gone.'] },
    el: { title: 'Η Φλόγα της Ειρήνης', kind: 'Αναμμένη από το 1964', facts: ['Η φλόγα καίει από το 1964.', 'Θα σβήσει μόνο όταν δεν θα υπάρχει πια κανένα πυρηνικό όπλο στη Γη.'] } },
  { id: 'bell', eras: ['today'], at: [-102, 5, 70], view: { pos: [-102, 0, 84], look: [-102, 2, 70] },
    en: { title: 'The Peace Bell', kind: 'Since 1964', facts: ['Visitors are welcome to ring the bell for peace.', 'Its surface is a map of the world with no borders between the countries. Point at the log and pull the trigger (or click) to ring it.'] },
    el: { title: 'Η Καμπάνα της Ειρήνης', kind: 'Από το 1964', facts: ['Οι επισκέπτες μπορούν να χτυπήσουν την καμπάνα για την ειρήνη.', 'Η επιφάνειά της είναι ένας χάρτης του κόσμου χωρίς σύνορα ανάμεσα στις χώρες. Δείξτε το κούτσουρο και πατήστε τη σκανδάλη (ή κάντε κλικ) για να τη χτυπήσετε.'] } },
  { id: 'cranes', eras: ['today'], at: [-128, 9, 40], view: { pos: [-128, 0, 58], look: [-128, 4, 40] },
    en: { title: 'Ten Million Cranes', kind: 'Sent from around the world', facts: ['Every year people send about ten million paper cranes to the monument, many of them folded by school classes.', 'Choose Leave a Paper Crane on the left to add yours: in a class session, everyone sees each other’s cranes.'] },
    el: { title: 'Δέκα Εκατομμύρια Γερανοί', kind: 'Από όλο τον κόσμο', facts: ['Κάθε χρόνο οι άνθρωποι στέλνουν περίπου δέκα εκατομμύρια χάρτινους γερανούς στο μνημείο, πολλούς από αυτούς διπλωμένους από σχολικές τάξεις.', 'Επιλέξτε «Αφήστε έναν Χάρτινο Γερανό» στα αριστερά για να προσθέσετε τον δικό σας: σε μια ομαδική συνεδρία, όλοι βλέπουν τους γερανούς των άλλων.'] } },
  { id: 'ceremony', eras: ['today'], at: [40, 9, -30], view: { pos: [22, 0, -48], look: [60, 3, -10] },
    en: { title: 'Every 6 August', kind: 'The Peace Memorial Ceremony', facts: ['Each year on 6 August the city holds a ceremony in the park, and at 8:15 the whole city keeps a minute of silence.', 'In the evening, paper lanterns carrying messages of peace are floated down the river.'] },
    el: { title: 'Κάθε 6 Αυγούστου', kind: 'Η Τελετή Μνήμης της Ειρήνης', facts: ['Κάθε χρόνο στις 6 Αυγούστου η πόλη πραγματοποιεί τελετή στο πάρκο, και στις 8:15 όλη η πόλη τηρεί ενός λεπτού σιγή.', 'Το βράδυ, χάρτινα φανάρια με μηνύματα ειρήνης αφήνονται να ταξιδέψουν στο ποτάμι.'] } },
];

/** What appears on screen, moment by moment, during 8:15 (seconds from the start). */
export const BLAST_CAPTIONS = [
  { t: 0, en: '8:15. The bomber Enola Gay, high above, has dropped an atomic bomb called Little Boy.', el: '8:15. Το βομβαρδιστικό Ενόλα Γκέι, ψηλά στον ουρανό, έχει ρίξει μια ατομική βόμβα με το όνομα Little Boy.' },
  { t: 7, en: 'About 600 metres above the city, the bomb explodes.', el: 'Περίπου 600 μέτρα πάνω από την πόλη, η βόμβα εκρήγνυται.' },
  { t: 9, en: 'A fireball hundreds of metres wide. On the ground below, the heat reaches thousands of degrees.', el: 'Μια πύρινη σφαίρα πλάτους εκατοντάδων μέτρων. Στο έδαφος από κάτω, η θερμοκρασία φτάνει χιλιάδες βαθμούς.' },
  { t: 12, en: 'The blast wave flattens almost every building within two kilometres.', el: 'Το ωστικό κύμα ισοπεδώνει σχεδόν κάθε κτίριο σε ακτίνα δύο χιλιομέτρων.' },
  { t: 17, en: 'Dust and smoke turn the morning dark. Fires start across the city.', el: 'Η σκόνη και ο καπνός σκοτεινιάζουν το πρωινό. Φωτιές ξεσπούν σε όλη την πόλη.' },
  { t: 25, en: 'Seen from the hills outside the city, a cloud rises more than 15 kilometres into the sky.', el: 'Από τους λόφους έξω από την πόλη, ένα σύννεφο υψώνεται περισσότερο από 15 χιλιόμετρα στον ουρανό.' },
  { t: 52, en: 'Hiroshima is burning.', el: 'Η Χιροσίμα καίγεται.' },
];

/** The closing quiz. */
export const QUIZ = [
  { en: { q: 'When did the bomb explode over Hiroshima?', a: ['8:15 in the morning, 6 August 1945', 'Midnight, 6 August 1945', '8:15 in the evening, 9 August 1945', 'Noon, 15 August 1945'] }, el: { q: 'Πότε εξερράγη η βόμβα πάνω από τη Χιροσίμα;', a: ['8:15 το πρωί, 6 Αυγούστου 1945', 'Τα μεσάνυχτα, 6 Αυγούστου 1945', '8:15 το βράδυ, 9 Αυγούστου 1945', 'Το μεσημέρι, 15 Αυγούστου 1945'] }, answer: 0 },
  { en: { q: 'Why was the Aioi Bridge chosen as the aiming point?', a: ['It was the longest bridge in Japan', 'Its T shape was easy to recognise from the air', 'It led to the army headquarters', 'It was made of steel'] }, el: { q: 'Γιατί επιλέχθηκε η Γέφυρα Αϊόι ως σημείο στόχευσης;', a: ['Ήταν η μεγαλύτερη γέφυρα της Ιαπωνίας', 'Το σχήμα Τ αναγνωριζόταν εύκολα από αέρος', 'Οδηγούσε στο στρατηγείο', 'Ήταν φτιαγμένη από χάλυβα'] }, answer: 1 },
  { en: { q: 'About how high above the city did the bomb explode?', a: ['On the ground', 'About 60 metres', 'About 600 metres', 'About 6 kilometres'] }, el: { q: 'Περίπου πόσο ψηλά πάνω από την πόλη εξερράγη η βόμβα;', a: ['Στο έδαφος', 'Περίπου 60 μέτρα', 'Περίπου 600 μέτρα', 'Περίπου 6 χιλιόμετρα'] }, answer: 2 },
  { en: { q: 'Why did the Industrial Promotion Hall stay standing?', a: ['It was made of steel throughout', 'The blast pushed down on it from almost straight above', 'It was far from the explosion', 'It was rebuilt the next day'] }, el: { q: 'Γιατί το Μέγαρο Προώθησης Βιομηχανίας έμεινε όρθιο;', a: ['Ήταν όλο από χάλυβα', 'Το ωστικό κύμα το πίεσε από σχεδόν ακριβώς από πάνω', 'Βρισκόταν μακριά από την έκρηξη', 'Ξαναχτίστηκε την επόμενη μέρα'] }, answer: 1 },
  { en: { q: 'What does the word hibakusha mean?', a: ['A paper crane', 'A city of peace', 'People affected by the bomb', 'The black rain'] }, el: { q: 'Τι σημαίνει η λέξη χιμπακούσα;', a: ['Ένας χάρτινος γερανός', 'Μια πόλη της ειρήνης', 'Οι άνθρωποι που επλήγησαν από τη βόμβα', 'Η μαύρη βροχή'] }, answer: 2 },
  { en: { q: 'Why did Sadako Sasaki fold paper cranes?', a: ['A thousand cranes are said to bring a wish', 'To sell them for the monument', 'As a school art project', 'To float them on the river'] }, el: { q: 'Γιατί η Σαντάκο Σασάκι δίπλωνε χάρτινους γερανούς;', a: ['Λέγεται ότι χίλιοι γερανοί φέρνουν μια ευχή', 'Για να τους πουλήσει για το μνημείο', 'Ως σχολική εργασία τέχνης', 'Για να τους αφήσει στο ποτάμι'] }, answer: 0 },
  { en: { q: 'Which flower became the symbol of Hiroshima?', a: ['The cherry blossom', 'The lotus', 'The oleander', 'The rose'] }, el: { q: 'Ποιο λουλούδι έγινε σύμβολο της Χιροσίμα;', a: ['Το άνθος της κερασιάς', 'Ο λωτός', 'Η πικροδάφνη', 'Το τριαντάφυλλο'] }, answer: 2 },
  { en: { q: 'How long will the Flame of Peace burn?', a: ['For one hundred years', 'Until every nuclear weapon is gone', 'Every 6 August only', 'Until the last survivor dies'] }, el: { q: 'Για πόσο θα καίει η Φλόγα της Ειρήνης;', a: ['Για εκατό χρόνια', 'Μέχρι να μην υπάρχει κανένα πυρηνικό όπλο', 'Μόνο κάθε 6 Αυγούστου', 'Μέχρι να πεθάνει ο τελευταίος επιζών'] }, answer: 1 },
];

/** Questions linking the visit to the novel (no plot details: the class brings the text). */
export const TEXT_QUESTIONS = {
  en: [
    'The Flowers of Hiroshima is set in the rebuilt city, years after the bomb. Having stood in the city before and after, what do you notice about how the past is still present in the story?',
    'Why might a survivor keep their illness, or the fact that they were in the city that day, a secret, even from people close to them?',
    'What could the flowers of the title stand for? Think of the oleander, and of the prediction that nothing would grow for 75 years.',
    'The writer chose to show the bomb through everyday family life rather than the moment of the explosion. Why might she have made that choice?',
  ],
  el: [
    'Το βιβλίο «Τα λουλούδια της Χιροσίμα» διαδραματίζεται στην ξαναχτισμένη πόλη, χρόνια μετά τη βόμβα. Αφού βρεθήκατε στην πόλη πριν και μετά, τι παρατηρείτε για το πώς το παρελθόν είναι ακόμη παρόν στην ιστορία;',
    'Γιατί ένας επιζών μπορεί να κρατά μυστική την αρρώστια του, ή το ότι βρισκόταν στην πόλη εκείνη τη μέρα, ακόμη και από ανθρώπους κοντινούς του;',
    'Τι θα μπορούσαν να συμβολίζουν τα λουλούδια του τίτλου; Σκεφτείτε την πικροδάφνη και την πρόβλεψη ότι τίποτα δεν θα φύτρωνε για 75 χρόνια.',
    'Η συγγραφέας επέλεξε να δείξει τη βόμβα μέσα από την καθημερινή οικογενειακή ζωή και όχι τη στιγμή της έκρηξης. Γιατί να έκανε αυτή την επιλογή;',
  ],
};

/** The words on buttons and headings. */
export const UI = {
  en: {
    lesson: 'Hiroshima, 1945', moments: 'Moments', places: 'Places', text: 'The Text', quiz: 'Quiz', moving: 'Moving',
    play815: 'Play 8:15', again: 'Watch Again', skip: 'Skip to After',
    crane: 'Leave a Paper Crane', cranesLeft: (n) => `${n} paper ${n === 1 ? 'crane' : 'cranes'} left by the class`,
    flash: (on) => `Bright flash: ${on ? 'on' : 'soft'}`, markers: (on) => `Markers: ${on ? 'on' : 'off'}`, turn: (l) => `Turn: ${l}`,
    language: 'Ελληνικά', welcome: 'Welcome', guide: 'GUIDE',
    welcomeText: ['Hiroshima, Japan. Walk the same streets in five moments: the morning of 6 August 1945, 8:15, the same afternoon, the rebuilt city of 1958 and today.', 'Choose a moment on the left. Every ⓘ marks something to discover: point at it, or click it.'],
    moveXR: 'Left stick: walk. Right stick: turn. Point at the ground and pull the trigger (or pinch) to jump there. B / Y: hide or show these panels.',
    moveDesk: 'W A S D or the arrow keys: walk. Drag to look around. Click the ground to go there. H: hide or show these panels.',
    textIntro: 'For The Flowers of Hiroshima by Edita Morris (1959). Discuss with a partner:',
    question: (i, n) => `Question ${i} of ${n}`, next: 'Next Question', finish: 'Finish', restart: 'Start Again',
    quizDone: (s, n) => `Quiz Done: ${s} of ${n}`, quizClose: 'Which moment of the visit will you remember most, and why?',
    right: 'Right.', wrong: (a) => `Not quite: the answer is “${a}”.`,
    showAll: 'Show everyone', showAllText: (m) => `Everyone is seeing ${m}. Choose another moment to move them all to it.`, showAllOff: 'Bring every student to the moment you are in, to see it together. Starting 8:15 then starts it for everyone.',
    showBtn: (m) => `Show Everyone ${m}`, showingBtn: 'Showing Everyone (Tap to Stop)',
    lookTogether: 'Look Together', lookTogetherText: 'Your teacher has brought everyone to this moment.',
    places_: { hall: 'The Hall', bridge: 'Aioi Bridge', island: 'The Island', street: 'The Street', park: 'Peace Park', monument: 'Children’s Monument' },
    craneLeft: 'Your Paper Crane', craneLeftText: 'Your crane hangs with the others at the Children’s Peace Monument.',
    bellRung: 'The Peace Bell', bellRungText: 'Its sound carries across the park.',
  },
  el: {
    lesson: 'Χιροσίμα, 1945', moments: 'Στιγμές', places: 'Μέρη', text: 'Το Κείμενο', quiz: 'Κουίζ', moving: 'Κίνηση',
    play815: 'Παίξτε το 8:15', again: 'Ξανά', skip: 'Στο Μετά',
    crane: 'Αφήστε έναν Χάρτινο Γερανό', cranesLeft: (n) => `${n} ${n === 1 ? 'χάρτινος γερανός' : 'χάρτινοι γερανοί'} από την τάξη`,
    flash: (on) => `Έντονη λάμψη: ${on ? 'ναι' : 'απαλή'}`, markers: (on) => `Σημάδια: ${on ? 'ναι' : 'όχι'}`, turn: (l) => `Στροφή: ${l}`,
    language: 'English', welcome: 'Καλώς ήρθατε', guide: 'ΟΔΗΓΟΣ',
    welcomeText: ['Χιροσίμα, Ιαπωνία. Περπατήστε στους ίδιους δρόμους σε πέντε στιγμές: το πρωί της 6ης Αυγούστου 1945, στις 8:15, το ίδιο απόγευμα, στην ξαναχτισμένη πόλη του 1958 και σήμερα.', 'Διαλέξτε μια στιγμή στα αριστερά. Κάθε ⓘ σημαίνει κάτι για να ανακαλύψετε: δείξτε το ή κάντε κλικ πάνω του.'],
    moveXR: 'Αριστερός μοχλός: περπάτημα. Δεξιός μοχλός: στροφή. Δείξτε το έδαφος και πατήστε τη σκανδάλη (ή τσιμπήστε) για να μεταφερθείτε εκεί. B / Y: απόκρυψη ή εμφάνιση των πινάκων.',
    moveDesk: 'W A S D ή τα βελάκια: περπάτημα. Σύρετε για να κοιτάξετε γύρω. Κάντε κλικ στο έδαφος για να πάτε εκεί. H: απόκρυψη ή εμφάνιση των πινάκων.',
    textIntro: 'Για το βιβλίο «Τα λουλούδια της Χιροσίμα» της Έντιτα Μόρις (1959). Συζητήστε με έναν συμμαθητή:',
    question: (i, n) => `Ερώτηση ${i} από ${n}`, next: 'Επόμενη Ερώτηση', finish: 'Τέλος', restart: 'Από την Αρχή',
    quizDone: (s, n) => `Τέλος Κουίζ: ${s} από ${n}`, quizClose: 'Ποια στιγμή της επίσκεψης θα θυμάστε περισσότερο και γιατί;',
    right: 'Σωστά.', wrong: (a) => `Όχι ακριβώς: η απάντηση είναι «${a}».`,
    showAll: 'Δείξτε σε όλους', showAllText: (m) => `Όλοι βλέπουν: ${m}. Διαλέξτε άλλη στιγμή για να τους μεταφέρετε όλους εκεί.`, showAllOff: 'Φέρτε όλους τους μαθητές στη στιγμή όπου βρίσκεστε, για να τη δείτε μαζί. Αν ξεκινήσετε το 8:15, ξεκινά για όλους.',
    showBtn: (m) => `Δείξτε σε Όλους: ${m}`, showingBtn: 'Το Βλέπουν Όλοι (Πατήστε για Τέλος)',
    lookTogether: 'Όλοι Μαζί', lookTogetherText: 'Ο εκπαιδευτικός σας έφερε όλους σε αυτή τη στιγμή.',
    places_: { hall: 'Το Μέγαρο', bridge: 'Γέφυρα Αϊόι', island: 'Το Νησί', street: 'Ο Δρόμος', park: 'Πάρκο Ειρήνης', monument: 'Μνημείο Παιδιών' },
    craneLeft: 'Ο Χάρτινος Γερανός σας', craneLeftText: 'Ο γερανός σας κρέμεται μαζί με τους άλλους στο Μνημείο Ειρήνης των Παιδιών.',
    bellRung: 'Η Καμπάνα της Ειρήνης', bellRungText: 'Ο ήχος της ακούγεται σε όλο το πάρκο.',
  },
};

/** Quick trips (feet position, and where to look). */
export const PLACES = [
  { id: 'street', pos: [-11, 0, -40], look: [8, 10, 4] },
  { id: 'hall', pos: [-14, 0, 22], look: [8, 12, 4] },
  { id: 'bridge', pos: [-150, 0.9, -78], look: [-60, 3, -78] },
  { id: 'island', pos: [-150, 0, -10], look: [8, 12, 4] },
  { id: 'park', pos: [-150, 0, 205], look: [8, 12, 4] },
  { id: 'monument', pos: [-128, 0, 60], look: [-128, 5, 40] },
];

/** Where everyone starts. */
export const START = { pos: [-11, 0, -40], look: [8, 10, 4] };
