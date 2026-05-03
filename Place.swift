import Foundation
import SwiftData

enum PlaceType: String, Codable, CaseIterable {
    case city
    case area
}

@Model
final class Place {
    @Attribute(.unique) var id: UUID
    var name: String

    // Stored as String because SwiftData persistence is most reliable with primitive types.
    var placeTypeRaw: String

    @Relationship(inverse: \Country.places) var country: Country

    @Relationship(inverse: \Activity.place) var activities: [Activity] = []
    @Relationship(inverse: \Accommodation.place) var accommodations: [Accommodation] = []

    init(id: UUID = UUID(), name: String, placeType: PlaceType, country: Country) {
        self.id = id
        self.name = name
        self.placeTypeRaw = placeType.rawValue
        self.country = country
    }

    var placeType: PlaceType {
        get { PlaceType(rawValue: placeTypeRaw) ?? .city }
        set { placeTypeRaw = newValue.rawValue }
    }
}

