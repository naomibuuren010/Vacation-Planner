import SwiftUI

struct CountryDetailView: View {
    let country: Country

    private var cities: [Place] {
        country.places
            .filter { $0.placeType == .city }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private var areas: [Place] {
        country.places
            .filter { $0.placeType == .area }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        List {
            if !cities.isEmpty {
                Section("Steden") {
                    ForEach(cities, id: \.id) { place in
                        NavigationLink {
                            PlaceDetailView(place: place)
                        } label: {
                            Text(place.name)
                        }
                    }
                }
            }

            if !areas.isEmpty {
                Section("Gebieden") {
                    ForEach(areas, id: \.id) { place in
                        NavigationLink {
                            PlaceDetailView(place: place)
                        } label: {
                            Text(place.name)
                        }
                    }
                }
            }

            if cities.isEmpty && areas.isEmpty {
                Section {
                    ContentUnavailableView("Nog geen steden of gebieden", systemImage: "map")
                        .listRowInsets(EdgeInsets())
                }
            }
        }
        .navigationTitle(country.name)
    }
}

