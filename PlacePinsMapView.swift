import SwiftUI
import MapKit

struct PlacePinsMapView: View {
    let place: Place

    enum PinKind {
        case activity
        case accommodation
    }

    struct PinItem: Identifiable {
        let id: UUID
        let kind: PinKind
        let title: String
        let subtitle: String?
        let coordinate: CLLocationCoordinate2D
        let url: String?
        let notes: String?
    }

    @State private var selectedPin: PinItem?

    private func pins() -> [PinItem] {
        let activityPins: [PinItem] = place.activities.compactMap { activity in
            guard let coordinate = activity.coordinate else { return nil }
            return PinItem(
                id: activity.id,
                kind: .activity,
                title: activity.title,
                subtitle: activity.locationName,
                coordinate: coordinate,
                url: activity.url,
                notes: activity.notes
            )
        }

        let accommodationPins: [PinItem] = place.accommodations.compactMap { accommodation in
            guard let coordinate = accommodation.coordinate else { return nil }
            return PinItem(
                id: accommodation.id,
                kind: .accommodation,
                title: accommodation.name,
                subtitle: accommodation.address ?? accommodation.locationName,
                coordinate: coordinate,
                url: accommodation.url,
                notes: accommodation.notes
            )
        }

        return activityPins + accommodationPins
    }

    private func region(for pins: [PinItem]) -> MKCoordinateRegion {
        let latitudes = pins.map { $0.coordinate.latitude }
        let longitudes = pins.map { $0.coordinate.longitude }

        guard let minLat = latitudes.min(),
              let maxLat = latitudes.max(),
              let minLng = longitudes.min(),
              let maxLng = longitudes.max()
        else {
            return MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 0, longitude: 0),
                span: MKCoordinateSpan(latitudeDelta: 30, longitudeDelta: 30)
            )
        }

        let latDelta = max(0.01, (maxLat - minLat) * 1.4)
        let lngDelta = max(0.01, (maxLng - minLng) * 1.4)

        let centerLat = (minLat + maxLat) / 2
        let centerLng = (minLng + maxLng) / 2

        return MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: centerLat, longitude: centerLng),
            span: MKCoordinateSpan(latitudeDelta: latDelta, longitudeDelta: lngDelta)
        )
    }

    var body: some View {
        let pins = pins()
        if pins.isEmpty {
            ContentUnavailableView("Geen pins om te tonen", systemImage: "mappin.slash")
                .frame(height: 220)
                .padding(.top, 8)
                .eraseToAnyView()
        } else {
            let reg = region(for: pins)
            Map(
                coordinateRegion: .constant(reg),
                annotationItems: pins
            ) { pin in
                MapAnnotation(coordinate: pin.coordinate) {
                    Button {
                        selectedPin = pin
                    } label: {
                        Image(systemName: pin.kind == .activity ? "mappin.circle.fill" : "building.2.fill")
                            .foregroundStyle(pin.kind == .activity ? .blue : .green)
                            .symbolRenderingMode(.hierarchical)
                            .font(.title3)
                    }
                }
            }
            .frame(height: 220)
            .padding(.top, 8)
            .sheet(item: $selectedPin) { pin in
                VStack(alignment: .leading, spacing: 12) {
                    Text(pin.title)
                        .font(.headline)

                    if let subtitle = pin.subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if let notes = pin.notes, !notes.isEmpty {
                        Text(notes)
                            .font(.body)
                    }

                    if let url = pin.url, !url.isEmpty {
                        Link("Open link", destination: URL(string: url) ?? URL(string: "https://example.com")!)
                    }

                    Spacer()
                }
                .padding()
                .presentationDetents([.medium])
            }
        }
    }
}

private extension View {
    // Helper om `ContentUnavailableView` (different types) consistent te kunnen returnen zonder extra generics.
    func eraseToAnyView() -> some View { self }
}

