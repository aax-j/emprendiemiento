export const CAR_BRANDS_AND_MODELS: Record<string, string[]> = {
  "Audi": [
    "A1", "A3", "A4", "A5", "A6", "A7", "A8", 
    "Q2", "Q3", "Q5", "Q7", "Q8", 
    "TT", "R8", "e-tron", "RS3", "RS4", "RS5", "RS6", "RS7"
  ].sort(),
  "BMW": [
    "Serie 1", "Serie 2", "Serie 3", "Serie 4", "Serie 5", "Serie 6", "Serie 7", "Serie 8", 
    "X1", "X2", "X3", "X4", "X5", "X6", "X7", 
    "Z4", "M2", "M3", "M4", "M5", "M8", "i3", "i4", "i8", "iX"
  ].sort(),
  "Chery": [
    "Tiggo 2", "Tiggo 2 Pro", "Tiggo 3", "Tiggo 4", "Tiggo 4 Pro", "Tiggo 7", "Tiggo 7 Pro", "Tiggo 8", "Tiggo 8 Pro", 
    "Arrizo 5", "QQ", "Fulwin", "Grand Tiggo"
  ].sort(),
  "Chevrolet": [
    "Spark", "Spark GT", "Sail", "Aveo", "Tracker", "Colorado", "Onix", "Captiva", "Silverado", "Tahoe", "Joy", 
    "Camaro", "Corvette", "Cruze", "Malibu", "Impala", "Equinox", "Traverse", "Suburban", "Trailblazer", "Blazer",
    "S10", "Corsa", "Astra", "Optra", "Cavalier", "Cobalt", "Groove", "Spin", "Montana", "D-Max"
  ].sort(),
  "Fiat": [
    "Mobi", "Argo", "Cronos", "Pulse", "Fastback", "Toro", "Fiorino", "Strada", 
    "Uno", "Palio", "Punto", "Siena", "Grand Siena", "500", "500X", "Ducato", "Idea", "Linea"
  ].sort(),
  "Ford": [
    "F-150", "F-250", "F-350", "Explorer", "Escape", "Ranger", "Edge", "Mustang", "EcoSport", "Bronco", "Bronco Sport", "Territory", 
    "Fiesta", "Focus", "Fusion", "Taurus", "Expedition", "Maverick", "Mach-E", "Ka", "Figo", "Transit"
  ].sort(),
  "Great Wall": [
    "Wingle 5", "Wingle 7", "Poer", "Haval H2", "Haval H6", "Haval Jolion", "Haval Dargo", "Voleex C30", "Deer", "Safe"
  ].sort(),
  "Honda": [
    "Civic", "CR-V", "HR-V", "Accord", "Pilot", "City", "Fit", "Odyssey", "Ridgeline", "Passport", "NSX", "S2000", "WR-V", "BR-V", "ZR-V"
  ].sort(),
  "Hyundai": [
    "Tucson", "Santa Fe", "Elantra", "Accent", "Creta", "i10", "Grand i10", "i20", "i30", "Kona", "Palisade", 
    "Sonata", "Azera", "Veloster", "Ioniq", "Ioniq 5", "Staria", "H-1", "Venue", "Cantus", "Atos", "Terracan", "Veracruz"
  ].sort(),
  "JAC": [
    "T8", "T6", "S2", "S3", "S4", "S5", "S7", "JS2", "JS3", "JS4", "JS6", "JS8", "J4", "Frison"
  ].sort(),
  "Jeep": [
    "Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator", "Patriot", "Commander", "Liberty", "Wagoneer"
  ].sort(),
  "Kia": [
    "Picanto", "Rio", "Sportage", "Cerato", "Forte", "Sorento", "Soul", "Niro", "Seltos", "Sonet", 
    "Optima", "K3", "K5", "Stinger", "Telluride", "Carnival", "Carens", "Mohave", "Soluto"
  ].sort(),
  "Mazda": [
    "Mazda2", "Mazda3", "Mazda5", "Mazda6", "CX-3", "CX-30", "CX-5", "CX-50", "CX-7", "CX-9", "CX-90", 
    "BT-50", "MX-5 (Miata)", "RX-7", "RX-8"
  ].sort(),
  "Mercedes-Benz": [
    "Clase A", "Clase B", "Clase C", "Clase E", "Clase S", "Clase G", 
    "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", 
    "AMG GT", "Sprinter", "Vito", "Citan"
  ].sort(),
  "Mitsubishi": [
    "L200", "Triton", "Outlander", "Montero", "Montero Sport", "Pajero", "ASX", "Eclipse Cross", 
    "Lancer", "Mirage", "Galant", "Xpander", "Nativa"
  ].sort(),
  "Nissan": [
    "Sentra", "Versa", "Frontier", "Navara", "NP300", "Kicks", "Qashqai", "X-Trail", "March", "Micra", "Patrol", 
    "Altima", "Maxima", "Pathfinder", "Armada", "Titan", "350Z", "370Z", "GT-R", "Leaf", "Murano", "Rogue", "Tiida", "Sunny", "Almera", "Urvan"
  ].sort(),
  "Peugeot": [
    "208", "308", "2008", "3008", "5008", "Partner", "206", "207", "301", "408", "508", "Expert", "Boxer", "Rifter"
  ].sort(),
  "Renault": [
    "Logan", "Sandero", "Duster", "Stepway", "Kwid", "Koleos", "Oroch", "Clio", "Megane", "Fluence", "Captur", "Kangoo", "Master", "Twingo", "Symbol", "Alaskan"
  ].sort(),
  "Suzuki": [
    "Grand Vitara", "Vitara", "Swift", "Jimny", "S-Cross", "Celerio", "Baleno", "Ertiga", "Ignis", "Dzire", "Alto", "APV", "SX4", "Fronx"
  ].sort(),
  "Toyota": [
    "Corolla", "Corolla Cross", "Yaris", "Yaris Cross", "Hilux", "RAV4", "Fortuner", "SW4", "Land Cruiser", "Prado", 
    "Camry", "Prius", "Agya", "Rush", "Tacoma", "Tundra", "4Runner", "Sequoia", "Sienna", "Supra", "86", "GR86", 
    "Celica", "MR2", "Tercel", "Starlet", "FJ Cruiser", "Vitz", "Avanza", "Innova", "Hiace", "Raize", "C-HR"
  ].sort(),
  "Volkswagen": [
    "Gol", "Polo", "Jetta", "Bora", "Vento", "Tiguan", "Amarok", "Virtus", "Nivus", "T-Cross", "Saveiro", 
    "Golf", "Passat", "Touareg", "Atlas", "Taos", "Fox", "Up!", "Scirocco", "Beetle", "Voyage", "Suran", "Transporter", "Crafter"
  ].sort(),
};

export const CAR_BRANDS = Object.keys(CAR_BRANDS_AND_MODELS).sort();
