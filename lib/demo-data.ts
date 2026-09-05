export type Kitchen = {
  id: string;
  name: string;
  cook: string;
  initials: string;
  cuisine: string;
  neighborhood: string;
  city: "Oakland" | "Berkeley";
  distance: number;
  rating10: number;
  reviews: number;
  image: string;
  imageAlt: string;
  description: string;
  pickup: string;
  today: boolean;
  badge?: string;
  menu: {
    name: string;
    description: string;
    priceCents: number;
    extra?: boolean;
  }[];
};

export const kitchens: Kitchen[] = [
  {
    id: "aminas-kitchen",
    name: "Amina’s Kitchen",
    cook: "Amina",
    initials: "AK",
    cuisine: "Pakistani",
    neighborhood: "Temescal",
    city: "Oakland",
    distance: 0.8,
    rating10: 9.8,
    reviews: 82,
    image: "/images/biryani.png",
    imageAlt: "Chicken biryani with saffron rice, herbs, and cucumber raita",
    pickup: "Today, 5–8 pm",
    today: true,
    badge: "Neighborhood favorite",
    description:
      "The kind of food that makes you stay for another helping. Amina cooks slow, generous Pakistani meals from family recipes, one small batch at a time.",
    menu: [
      {
        name: "Sunday chicken biryani",
        description:
          "Layered basmati, warm spices, fried onions, and a little raita.",
        priceCents: 1400,
      },
      {
        name: "Slow-cooked chicken karahi",
        description: "Tomatoes, ginger, green chilies, and fresh roti.",
        priceCents: 1650,
      },
      {
        name: "Cardamom rice pudding",
        description: "A creamy little something to finish.",
        priceCents: 500,
        extra: true,
      },
    ],
  },
  {
    id: "nouras-table",
    name: "Noura’s Table",
    cook: "Noura",
    initials: "NT",
    cuisine: "Middle Eastern",
    neighborhood: "Rockridge",
    city: "Oakland",
    distance: 1.2,
    rating10: 9.6,
    reviews: 46,
    image: "/images/mezze.jpg",
    imageAlt: "A colorful fresh bowl with vegetables and greens",
    pickup: "Today, 4–7 pm",
    today: true,
    badge: "A little something fresh",
    description:
      "Bright herbs, generous bowls, and the joy of sharing. Noura’s table is all about everyday Middle Eastern comfort, with plenty for plant lovers.",
    menu: [
      {
        name: "The falafel & greens bowl",
        description: "Crisp falafel, seasonal greens, lemon, and tahini.",
        priceCents: 1250,
      },
      {
        name: "The mezze box",
        description: "Hummus, baba ganoush, pickles, and warm flatbread.",
        priceCents: 1500,
      },
      {
        name: "Orange blossom lemonade",
        description: "Fresh lemon, a little blossom, lots of sunshine.",
        priceCents: 400,
        extra: true,
      },
    ],
  },
  {
    id: "rafis-rannaghor",
    name: "Rafi’s Rannaghor",
    cook: "Rafi",
    initials: "RR",
    cuisine: "Bangladeshi",
    neighborhood: "Elmwood",
    city: "Berkeley",
    distance: 2.1,
    rating10: 9.8,
    reviews: 38,
    image: "/images/samosa.jpg",
    imageAlt: "Golden South Asian pastries with dipping sauces",
    pickup: "Tomorrow, 12–3 pm",
    today: false,
    description:
      "Rannaghor means kitchen. This one smells like toasted spices, freshly fried shingara, and something good simmering on the stove.",
    menu: [
      {
        name: "Shingara & afternoon chai",
        description: "Golden pastry, spiced potato, and a cup of milk tea.",
        priceCents: 1000,
      },
      {
        name: "Dhaka-style chicken biryani",
        description:
          "Fragrant rice, tender chicken, and a perfectly spiced potato.",
        priceCents: 1600,
      },
      {
        name: "Dal & vegetable bhorta",
        description: "Lentils, mashed vegetables, and steamed rice.",
        priceCents: 1200,
      },
    ],
  },
  {
    id: "meeras-spicebox",
    name: "Meera’s Spicebox",
    cook: "Meera",
    initials: "MS",
    cuisine: "Indian",
    neighborhood: "Lakeshore",
    city: "Oakland",
    distance: 1.7,
    rating10: 9.4,
    reviews: 61,
    image: "/images/curry.jpg",
    imageAlt: "Rich red-orange curry garnished with fresh herbs",
    pickup: "Today, 5–7:30 pm",
    today: true,
    description:
      "A well-loved spicebox, a few very good recipes, and a cook who insists you take a little more. Meera makes familiar favorites feel special.",
    menu: [
      {
        name: "Butter chicken & basmati",
        description:
          "A gently spiced tomato gravy, fragrant rice, and fluffy naan.",
        priceCents: 1550,
      },
      {
        name: "Chana masala",
        description: "Chickpeas with ginger and a bright squeeze of lemon.",
        priceCents: 1300,
      },
      {
        name: "Mango lassi",
        description: "Thick yogurt, ripe mango, and cardamom.",
        priceCents: 450,
        extra: true,
      },
    ],
  },
  {
    id: "samirs-grill",
    name: "Samir’s Sunday Grill",
    cook: "Samir",
    initials: "SG",
    cuisine: "Middle Eastern",
    neighborhood: "Northside",
    city: "Berkeley",
    distance: 3.2,
    rating10: 9.6,
    reviews: 27,
    image: "/images/grill.jpg",
    imageAlt: "A freshly prepared chicken meal with bright garnishes",
    pickup: "Tomorrow, 4–7 pm",
    today: false,
    badge: "Worth making plans for",
    description:
      "The grill is on, the bread is warm, and the garlic sauce is homemade. Samir’s weekend plates bring a little gathering to your dinner table.",
    menu: [
      {
        name: "The chicken grill plate",
        description: "Marinated chicken, flatbread, salad, and garlic sauce.",
        priceCents: 1700,
      },
      {
        name: "Grilled vegetable plate",
        description: "Seasonal vegetables, hummus, and warm bread.",
        priceCents: 1600,
      },
      {
        name: "Extra garlic sauce",
        description: "For the people who always ask for more.",
        priceCents: 200,
        extra: true,
      },
    ],
  },
  {
    id: "maryams-oven",
    name: "Maryam’s Little Oven",
    cook: "Maryam",
    initials: "MO",
    cuisine: "Bakes & bites",
    neighborhood: "Downtown",
    city: "Berkeley",
    distance: 2.8,
    rating10: 10,
    reviews: 19,
    image: "/images/bread.jpg",
    imageAlt: "Fresh artisan bread with golden, flour-dusted crusts",
    pickup: "Today, 10 am–1 pm",
    today: true,
    badge: "Fresh from the oven",
    description:
      "Early mornings, flour on the counter, and something lovely rising in the oven. Small-batch breads and sweet treats, baked with a lot of patience.",
    menu: [
      {
        name: "The weekend bread basket",
        description: "A little selection of today’s freshly baked favorites.",
        priceCents: 1100,
      },
      {
        name: "Date & walnut cake",
        description: "A generous slice, lovely with a cup of tea.",
        priceCents: 550,
      },
      {
        name: "Orange blossom buns",
        description: "Two soft, fragrant buns with a light glaze.",
        priceCents: 700,
      },
    ],
  },
];

export const stories = [
  {
    id: "story-1",
    name: "Yusuf",
    initials: "YA",
    kitchenId: "aminas-kitchen",
    time: "2 hours ago",
    rating10: 10,
    title: "Tastes like a Sunday at home.",
    body: "The biryani was incredible. Proper layers, perfectly cooked rice, and the raita deserves its own review. Already thinking about next weekend.",
  },
  {
    id: "story-2",
    name: "Hana",
    initials: "HM",
    kitchenId: "nouras-table",
    time: "4 hours ago",
    rating10: 10,
    title: "My new lunch ritual.",
    body: "Fresh, generous, and that tahini dressing! Noura even tucked in a little extra bread. This is why I love finding neighborhood cooks.",
  },
  {
    id: "story-3",
    name: "Omar",
    initials: "OK",
    kitchenId: "maryams-oven",
    time: "Yesterday",
    rating10: 10,
    title: "Didn’t make it all the way home.",
    body: "Had to try a warm bun on the walk back. No regrets. The rest of the bread basket was gone by dinner. See you next Saturday, Maryam.",
  },
];
