import Foundation
import SwiftData

@Model
final class Country {
    @Attribute(.unique) var id: UUID
    var name: String

    @Relationship(inverse: \Place.country) var places: [Place] = []

    init(id: UUID = UUID(), name: String) {
        self.id = id
        self.name = name
    }
}

