import SwiftUI

struct PlaceDetailView: View {
    let place: Place
    @Environment(\.modelContext) private var modelContext

    @State private var showingAddActivity = false
    @State private var showingAddAccommodation = false

    @State private var editingActivity: Activity?
    @State private var editingAccommodation: Accommodation?

    private var sortedActivities: [Activity] {
        place.activities
            .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    private var sortedAccommodations: [Accommodation] {
        place.accommodations
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    var body: some View {
        List {
            Section {
                PlacePinsMapView(place: place)
            }

            Section("Activiteiten") {
                if sortedActivities.isEmpty {
                    ContentUnavailableView("Geen activiteiten", systemImage: "list.bullet")
                        .foregroundStyle(.secondary)
                        .listRowInsets(EdgeInsets())
                } else {
                    ForEach(sortedActivities, id: \.id) { activity in
                        Button {
                            editingActivity = activity
                            showingAddActivity = true
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(activity.title)
                                    .font(.headline)
                                if let locationName = activity.locationName, !locationName.isEmpty {
                                    Text(locationName)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            let activity = sortedActivities[index]
                            modelContext.delete(activity)
                        }
                        try? modelContext.save()
                    }
                }

                Button {
                    editingActivity = nil
                    showingAddActivity = true
                } label: {
                    Label("Voeg activiteit toe", systemImage: "plus")
                }
            }

            Section("Hotels") {
                if sortedAccommodations.isEmpty {
                    ContentUnavailableView("Geen hotels", systemImage: "building.2")
                        .foregroundStyle(.secondary)
                        .listRowInsets(EdgeInsets())
                } else {
                    ForEach(sortedAccommodations, id: \.id) { accommodation in
                        Button {
                            editingAccommodation = accommodation
                            showingAddAccommodation = true
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(accommodation.name)
                                    .font(.headline)
                                if let address = accommodation.address, !address.isEmpty {
                                    Text(address)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet {
                            let accommodation = sortedAccommodations[index]
                            modelContext.delete(accommodation)
                        }
                        try? modelContext.save()
                    }
                }

                Button {
                    editingAccommodation = nil
                    showingAddAccommodation = true
                } label: {
                    Label("Voeg hotel toe", systemImage: "plus")
                }
            }
        }
        .navigationTitle(place.name)
        .sheet(isPresented: $showingAddActivity) {
            AddEditActivityView(place: place, activity: editingActivity)
        }
        .sheet(isPresented: $showingAddAccommodation) {
            AddEditAccommodationView(place: place, accommodation: editingAccommodation)
        }
    }
}

