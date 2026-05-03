import Foundation
import SwiftData
import CoreLocation

@Model
final class Activity {
    @Attribute(.unique) var id: UUID

    var title: String
    var notes: String?
    var url: String?
    var locationName: String?
    var date: Date?

    // Offline pin support (lat/lng stored directly).
    var latitude: Double?
    var longitude: Double?

    @Relationship(inverse: \Place.activities) var place: Place

    init(
        id: UUID = UUID(),
        place: Place,
        title: String,
        notes: String? = nil,
        url: String? = nil,
        locationName: String? = nil,
        date: Date? = nil,
        latitude: Double? = nil,
        longitude: Double? = nil
    ) {
        self.id = id
        self.place = place
        self.title = title
        self.notes = notes
        self.url = url
        self.locationName = locationName
        self.date = date
        self.latitude = latitude
        self.longitude = longitude
    }

    var coordinate: CLLocationCoordinate2D? {
        guard let lat = latitude, let lng = longitude else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }
}

