import Foundation
import SwiftData
import CoreLocation

@Model
final class Accommodation {
    @Attribute(.unique) var id: UUID

    var name: String
    var address: String?
    var locationName: String?
    var notes: String?
    var url: String?
    var date: Date? // optional for future enhancements; can be unused in MVP

    var latitude: Double?
    var longitude: Double?

    @Relationship(inverse: \Place.accommodations) var place: Place

    init(
        id: UUID = UUID(),
        place: Place,
        name: String,
        address: String? = nil,
        locationName: String? = nil,
        notes: String? = nil,
        url: String? = nil,
        date: Date? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.id = id
        self.place = place
        self.name = name
        self.address = address
        self.locationName = locationName
        self.notes = notes
        self.url = url
        self.date = date
        self.latitude = latitude
        self.longitude = longitude
    }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

