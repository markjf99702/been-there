// How people in each state tend to say things. Each word lists where each answer is the usual one; any state not
// listed gets `base`. `hints` are the split inside a state that a state-sized guess can't see.
// Drawn from the big American dialect surveys (Bert Vaux's Harvard Dialect Survey, the Dictionary of American
// Regional English) and the long-running soda/pop counts, simplified to one answer per state.

const NEW_ENGLAND = 'CT ME MA NH RI VT';
const WEST = 'WA OR CA NV ID MT WY UT CO AZ NM AK HI';

export const WORDS = [
  {
    id: 'soda', ask: 'A sweet, fizzy drink in a can',
    base: 'soda',
    says: {
      soda: { say: 'soda', where: 'The Northeast, California, Florida and the Southwest, plus St. Louis and Milwaukee.' },
      pop: { say: 'pop', where: 'The Midwest, the Plains, the Rockies and the Northwest.' },
      coke: { say: 'coke', where: 'The South, for any flavor: “What kind of coke?” “Sprite.”' },
    },
    map: {
      pop: 'WA OR ID MT WY ND SD NE KS OK MN IA MI IN OH WV CO UT AK IL MO',
      coke: 'TX LA MS AL GA TN AR SC NC KY',
    },
    hints: {
      MO: 'soda around St. Louis, pop around Kansas City',
      IL: 'soda in the St. Louis suburbs',
      WI: 'pop up north and out west',
      PA: 'pop around Pittsburgh',
      NY: 'pop in Buffalo and Rochester',
      FL: 'coke in the Panhandle',
      NC: 'soda in Raleigh and Charlotte',
      VA: 'coke out in the southwest of the state',
      OK: 'coke down south',
      KY: 'pop up north near Cincinnati',
    },
  },
  {
    id: 'yall', ask: 'Talking to a group of people',
    base: 'guys',
    says: {
      guys: { say: 'you guys', where: 'Most of the North and West.' },
      yall: { say: 'y’all', where: 'The South, and it keeps spreading.' },
      yinz: { say: 'yinz', where: 'Pittsburgh and western Pennsylvania.' },
      youuns: { say: 'you’uns', where: 'The Appalachian hills, where yinz came from.' },
    },
    map: { yall: 'TX OK LA AR MS AL GA FL TN KY SC NC VA WV' },
    hints: {
      PA: 'yinz if you’re from Pittsburgh; youse in parts of Philly',
      FL: 'you guys in South Florida',
      VA: 'you guys in Northern Virginia',
      WV: 'you’uns in the hills',
      TN: 'you’uns in the east of the state',
      NJ: 'youse, if you’re from the right neighborhood',
      NY: 'youse in parts of the city',
    },
  },
  {
    id: 'fountain', ask: 'The thing in a school hallway you drink water from',
    base: 'water',
    says: {
      water: { say: 'water fountain', where: 'The East and the South.' },
      drinking: { say: 'drinking fountain', where: 'The West and much of the Midwest.' },
      bubbler: { say: 'bubbler', where: 'Wisconsin, Rhode Island and eastern Massachusetts.' },
    },
    map: {
      bubbler: 'WI RI MA',
      drinking: `${WEST} MN ND SD NE KS IA IL`,
    },
    hints: {
      MA: 'water fountain out west of Worcester',
      OR: 'in Portland, the Benson Bubblers made bubbler a local word too',
    },
  },
  {
    id: 'sub', ask: 'A long sandwich of cold cuts on a roll',
    base: 'sub',
    says: {
      sub: { say: 'sub', where: 'Most of the country.' },
      hoagie: { say: 'hoagie', where: 'Philadelphia and all of Pennsylvania, South Jersey and Delaware.' },
      hero: { say: 'hero', where: 'New York City.' },
      grinder: { say: 'grinder', where: 'Connecticut, Rhode Island, Vermont and western Massachusetts.' },
      poboy: { say: 'po’ boy', where: 'Louisiana, where it comes on French bread.' },
    },
    map: { hoagie: 'PA DE', hero: 'NY', grinder: 'CT RI VT', poboy: 'LA' },
    hints: {
      NY: 'sub, if you grew up upstate',
      NJ: 'hoagie in South Jersey',
      MA: 'grinder in western Mass',
      ME: 'an Italian, if it’s the Maine kind',
    },
  },
  {
    id: 'sneakers', ask: 'Shoes you’d wear to the gym',
    base: 'tennis',
    says: {
      tennis: { say: 'tennis shoes', where: 'The South, the Midwest and the West.' },
      sneakers: { say: 'sneakers', where: 'New England, New York, New Jersey, Pennsylvania and down to DC.' },
      gym: { say: 'gym shoes', where: 'Chicago, and parts of Ohio and Michigan.' },
    },
    map: { sneakers: `${NEW_ENGLAND} NY NJ PA DE MD DC`, gym: 'IL' },
    hints: {
      OH: 'gym shoes around Cleveland and Cincinnati',
      MI: 'gym shoes around Detroit',
      FL: 'sneakers in South Florida',
      VA: 'sneakers in Northern Virginia',
    },
  },
  {
    id: 'cart', ask: 'What you push around the grocery store',
    base: 'cart',
    says: {
      cart: { say: 'shopping cart', where: 'Most of the country.' },
      buggy: { say: 'buggy', where: 'The South.' },
      carriage: { say: 'carriage', where: 'Boston, Rhode Island, New Hampshire and Maine.' },
    },
    map: { buggy: 'AL MS GA LA TN SC AR KY NC', carriage: 'MA NH ME RI' },
    hints: { TX: 'buggy in East Texas', WV: 'buggy in the south of the state', MA: 'cart, out west of Worcester' },
  },
  {
    id: 'firefly', ask: 'A bug that blinks on summer nights',
    base: 'lightning',
    says: {
      lightning: { say: 'lightning bug', where: 'The South, the Midwest and the Mid-Atlantic.' },
      firefly: { say: 'firefly', where: 'New England and the West, where there aren’t as many to name.' },
    },
    map: { firefly: `${NEW_ENGLAND} ${WEST}` },
    hints: {},
  },
  {
    id: 'crawfish', ask: 'The little lobster that lives in creeks',
    base: 'crawdad',
    says: {
      crawfish: { say: 'crawfish', where: 'The South, and above all Louisiana, which boils them by the sack.' },
      crawdad: { say: 'crawdad', where: 'The Ozarks, the Plains, the West and the mountains.' },
      crayfish: { say: 'crayfish', where: 'The Northeast and around the Great Lakes, and in textbooks.' },
    },
    map: {
      crawfish: 'LA TX MS AL AR GA FL SC NC TN VA',
      crayfish: `${NEW_ENGLAND} NY NJ PA DE MD DC MI WI MN OH IL IN`,
    },
    hints: {},
  },
  {
    id: 'sale', ask: 'Selling your old stuff on a Saturday, at your house',
    base: 'garage',
    says: {
      garage: { say: 'garage sale', where: 'The Midwest and the West, Texas included.' },
      yard: { say: 'yard sale', where: 'The South and the East.' },
      tag: { say: 'tag sale', where: 'Connecticut and the parts of New York next to it.' },
    },
    map: {
      yard: 'VA WV KY TN NC SC GA FL AL MS LA AR PA MD DE DC ME NH VT MA RI',
      tag: 'CT',
    },
    hints: {
      NY: 'tag sale near the Connecticut line',
      WI: 'a rummage sale is the church-basement kind',
      MN: 'a rummage sale is the church-basement kind',
    },
  },
  {
    id: 'liquor', ask: 'Where you buy a bottle of whiskey',
    base: 'liquor',
    says: {
      liquor: { say: 'liquor store', where: 'Most of the country.' },
      packie: { say: 'package store (the packie)', where: 'Massachusetts, Connecticut and Rhode Island.' },
      party: { say: 'party store', where: 'Michigan, where it also sells milk and lottery tickets.' },
      abc: { say: 'ABC store', where: 'Virginia, North Carolina and Alabama, where the state runs it.' },
      state: { say: 'the state store', where: 'Pennsylvania, Utah and New Hampshire, where the state runs it too.' },
    },
    map: { packie: 'MA CT RI', party: 'MI', abc: 'VA NC AL', state: 'PA UT NH' },
    hints: {},
  },
  {
    id: 'rotary', ask: 'A circle in the road that cars go around',
    base: 'roundabout',
    says: {
      roundabout: { say: 'roundabout', where: 'Most of the country, which built them recently.' },
      rotary: { say: 'rotary', where: 'New England, which built them early.' },
      circle: { say: 'traffic circle', where: 'New Jersey, Pennsylvania and down to DC.' },
    },
    map: { rotary: NEW_ENGLAND, circle: 'NJ PA DE MD DC' },
    hints: {},
  },
  {
    id: 'jimmies', ask: 'The little colored bits on an ice cream cone',
    base: 'sprinkles',
    says: {
      sprinkles: { say: 'sprinkles', where: 'Nearly everywhere.' },
      jimmies: { say: 'jimmies', where: 'Boston and the rest of eastern New England, and Philadelphia.' },
    },
    map: { jimmies: 'MA RI NH ME PA' },
    hints: { PA: 'sprinkles around Pittsburgh', MA: 'some say jimmies are only the chocolate ones' },
  },
  {
    id: 'frappe', ask: 'Milk, ice cream and syrup, blended thick',
    base: 'milkshake',
    says: {
      milkshake: { say: 'milkshake', where: 'Nearly everywhere.' },
      frappe: { say: 'frappe', where: 'Massachusetts, New Hampshire and Maine, where a milkshake has no ice cream in it.' },
      cabinet: { say: 'cabinet', where: 'Rhode Island, and nowhere else.' },
    },
    map: { frappe: 'MA NH ME', cabinet: 'RI' },
    hints: {},
  },
  {
    id: 'snowcone', ask: 'Shaved ice with syrup poured over it',
    base: 'snowcone',
    says: {
      snowcone: { say: 'snow cone', where: 'Most of the country.' },
      shave: { say: 'shave ice', where: 'Hawaii (not “shaved”).' },
      snoball: { say: 'sno-ball', where: 'New Orleans and Baltimore, each in its own style.' },
      water: { say: 'water ice', where: 'Philadelphia and around it.' },
      italian: { say: 'Italian ice', where: 'New York and North Jersey.' },
    },
    map: { shave: 'HI', snoball: 'LA MD', water: 'PA DE', italian: 'NY NJ' },
    hints: { PA: 'snow cone outside Philly', NJ: 'water ice in South Jersey' },
  },
  {
    id: 'hotdish', ask: 'Tater tots, cream of mushroom soup and ground beef, baked in a pan',
    base: 'casserole',
    says: {
      casserole: { say: 'casserole', where: 'Nearly everywhere.' },
      hotdish: { say: 'hotdish', where: 'Minnesota and the Dakotas.' },
    },
    map: { hotdish: 'MN ND SD' },
    hints: { WI: 'hotdish up north' },
  },
  {
    id: 'kitty', ask: 'Diagonally across the intersection',
    base: 'catty',
    says: {
      catty: { say: 'catty-corner', where: 'The South and the East.' },
      kitty: { say: 'kitty-corner', where: 'The Midwest and the West.' },
    },
    map: { kitty: `${WEST} ND SD NE KS MN IA WI IL MI IN OH MO` },
    hints: {},
  },
  {
    id: 'ope', ask: 'What slips out when you nearly bump into someone',
    base: 'sorry',
    says: {
      sorry: { say: 'sorry', where: 'Most of the country.' },
      ope: { say: 'ope', where: 'The Midwest, usually followed by “just gonna squeeze past ya.”' },
    },
    map: { ope: 'MN WI IA IL IN MI OH MO KS NE ND SD' },
    hints: {},
  },
  {
    id: 'fixing', ask: 'About to do something',
    base: 'about',
    says: {
      about: { say: 'about to', where: 'Most of the country.' },
      fixing: { say: 'fixin’ to', where: 'The South, Texas especially.' },
    },
    map: { fixing: 'TX OK LA AR MS AL GA TN SC NC' },
    hints: { FL: 'fixin’ to in North Florida', KY: 'fixin’ to in the south of the state' },
  },
  {
    id: 'freeway', ask: 'How you’d name Interstate 405',
    base: 'plain',
    says: {
      plain: { say: '405, or I-405', where: 'Most of the country.' },
      the: { say: 'the 405', where: 'Southern California, and Buffalo, which says “the 190.”' },
    },
    map: { the: 'CA' },
    hints: { CA: 'just 280 or 101, if you’re from the Bay Area', NY: 'the 90, if you’re from Buffalo' },
  },
  {
    id: 'strip', ask: 'The strip of grass between the sidewalk and the street',
    base: 'none',
    says: {
      none: { say: 'no word for it', where: 'Most people. It’s the one on this list that stumps everybody.' },
      treelawn: { say: 'tree lawn', where: 'Cleveland, and Akron calls it the devil strip.' },
      boulevard: { say: 'boulevard', where: 'Minnesota and North Dakota.' },
      terrace: { say: 'terrace', where: 'Wisconsin.' },
      parkway: { say: 'parkway', where: 'Chicago.' },
      parkstrip: { say: 'park strip', where: 'Utah and Idaho.' },
      planting: { say: 'planting strip', where: 'Seattle and Portland.' },
    },
    map: { treelawn: 'OH', boulevard: 'MN ND', terrace: 'WI', parkway: 'IL', parkstrip: 'UT ID', planting: 'WA OR' },
    hints: { OH: 'devil strip, if you’re from Akron' },
  },
  {
    id: 'cot', ask: 'Do “cot” and “caught” sound the same?',
    base: 'different',
    says: {
      different: { say: 'they sound different', where: 'The East Coast, the South and around the Great Lakes.' },
      same: { say: 'they sound the same', where: 'The West, the Plains, Pittsburgh and eastern New England.' },
    },
    map: { same: `${WEST} MN ND SD NE KS IA MA NH ME VT` },
    hints: { PA: 'the same, if you’re from Pittsburgh', TX: 'the same, more and more, among younger Texans' },
  },
  {
    id: 'aunt', ask: 'Your mother’s sister',
    base: 'ant',
    says: {
      ant: { say: 'aunt, like the bug', where: 'Most of the country.' },
      ahnt: { say: 'aunt, like “font”', where: 'New England, and Tidewater Virginia.' },
    },
    map: { ahnt: NEW_ENGLAND },
    hints: { VA: 'ahnt around Richmond and the Tidewater' },
  },
  {
    id: 'wicked', ask: 'That pizza was ___ good',
    base: 'really',
    says: {
      really: { say: 'really', where: 'Most of the country.' },
      wicked: { say: 'wicked', where: 'New England.' },
      hella: { say: 'hella', where: 'Northern California, from the Bay Area on up.' },
    },
    map: { wicked: 'MA NH ME RI VT', hella: 'CA' },
    hints: { CA: 'super, if you’re from SoCal', NY: 'mad good, in the city' },
  },
  {
    id: 'supper', ask: 'The meal at the end of the day',
    base: 'dinner',
    says: {
      dinner: { say: 'dinner', where: 'Most of the country.' },
      supper: { say: 'supper', where: 'The rural South and the Upper Midwest, where dinner can be the meal at noon.' },
    },
    map: { supper: 'MN ND SD WI IA AL MS AR TN KY WV' },
    hints: {},
  },
];

// The answer a state gives for a word, and any note about splits inside it.
export function answerIn(word, state) {
  for (const [key, list] of Object.entries(word.map)) if (list.split(' ').includes(state)) return key;
  return word.base;
}
