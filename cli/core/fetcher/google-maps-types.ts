import { Category } from '~/types/crypto-map'

export function parseGoogleTypes(googleTypes: string[]): Category {
  const mapping: Record<Category, string[]> = {
    [Category.Cash]: ['atm', 'bank', 'currency_exchange', 'finance', 'insurance_agency', 'lawyer', 'money_transfer', 'travel_agency'],
    [Category.CarsBikes]: ['car_dealer', 'car_rental', 'car_repair', 'car_wash', 'gas_station', 'parking', 'taxi_stand', 'train_station', 'transit_station'],
    [Category.ComputerElectronics]: ['hardware_store', 'locksmith', 'moving_company', 'painter', 'plumber', 'roofing_contractor'],
    [Category.Entertainment]: ['amusement_park', 'aquarium', 'art_gallery', 'bowling_alley', 'casino', 'movie_theater', 'night_club', 'stadium', 'zoo'],
    [Category.LeisureActivities]: ['beauty_salon', 'bicycle_store', 'campground', 'laundry', 'library', 'movie_rental', 'museum'],
    [Category.FoodDrinks]: ['bakery', 'cafe', 'food'],
    [Category.RestaurantBar]: ['bar', 'meal_delivery', 'meal_takeaway', 'restaurant'],
    [Category.HealthBeauty]: ['dentist', 'doctor', 'drugstore', 'hair_care', 'hospital', 'pharmacy', 'physiotherapist', 'spa', 'veterinary_care'],
    [Category.SportsFitness]: ['gym', 'park'],
    [Category.HotelLodging]: ['lodging', 'rv_park'],
    [Category.Shop]: ['book_store', 'clothing_store', 'convenience_store', 'department_store', 'electronics_store', 'florist', 'furniture_store', 'home_goods_store', 'jewelry_store', 'liquor_store', 'pet_store', 'shoe_store', 'shopping_mall', 'store', 'supermarket'],
    [Category.Miscellaneous]: ['accounting', 'airport', 'bus_station', 'cemetery', 'church', 'city_hall', 'courthouse', 'electrician', 'embassy', 'fire_station', 'funeral_home', 'hindu_temple', 'light_rail_station', 'local_government_office', 'mosque', 'police', 'post_office', 'primary_school', 'real_estate_agency', 'school', 'secondary_school', 'storage', 'subway_station', 'synagogue', 'tourist_attraction', 'university'],
  }

  for (const googleType of googleTypes) {
    for (const myType in mapping) {
      if (mapping[myType as Category].includes(googleType) && myType !== Category.Miscellaneous)
        return myType as Category
    }
  }

  return Category.Miscellaneous
}
