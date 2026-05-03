import SwiftUI
import SwiftData
import CoreLocation

struct AddEditAccommodationView: View {
    let place: Place
    let accommodation: Accommodation?

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var address: String
    @State private var notes: String
    @State private var url: String

    @State private var latitude: Double?
    @State private var longitude: Double?
    @State private var showPickOnMap = false

    init(place: Place, accommodation: Accommodation?) {
        self.place = place
        self.accommodation = accommodation

        _name = State(initialValue: accommodation?.name ?? "")
        _address = State(initialValue: accommodation?.address ?? "")
        _notes = State(initialValue: accommodation?.notes ?? "")
        _url = State(initialValue: accommodation?.url ?? "")

        _latitude = State(initialValue: accommodation?.latitude)
        _longitude = State(initialValue: accommodation?.longitude)
    }

    private var canSave: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func currentCoordinate() -> CLLocationCoordinate2D? {
        guard let latitude, let longitude else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Hotel") {
                    TextField("Naam", text: $name)

                    TextField("Adres/locatie (optioneel)", text: $address)

                    TextField("Notities (optioneel)", text: $notes, axis: .vertical)
                        .lineLimit(3...6)

                    TextField("Link/URL (optioneel)", text: $url)
                }

                Section("Locatiepin (optioneel)") {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Coördinaten")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            if let latitude, let longitude {
                                Text("\(latitude, specifier: "%.5f") , \(longitude, specifier: "%.5f")")
                                    .font(.footnote)
                            } else {
                                Text("Geen pin gekozen")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Button("Kies op kaart") {
                            showPickOnMap = true
                        }
                    }

                    if latitude != nil || longitude != nil {
                        Button(role: .destructive) {
                            latitude = nil
                            longitude = nil
                        } label: {
                            Label("Verwijder locatie", systemImage: "trash")
                        }
                    }
                }
            }
            .navigationTitle(accommodation == nil ? "Nieuw hotel" : "Bewerk hotel")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Opslaan") {
                        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
                        let addressOrNil = address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : address
                        let notesOrNil = notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes
                        let urlOrNil = url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : url

                        if let accommodation {
                            accommodation.name = trimmedName
                            accommodation.address = addressOrNil
                            accommodation.notes = notesOrNil
                            accommodation.url = urlOrNil
                            accommodation.latitude = latitude
                            accommodation.longitude = longitude
                        } else {
                            let newAccommodation = Accommodation(
                                place: place,
                                name: trimmedName,
                                address: addressOrNil,
                                locationName: nil,
                                notes: notesOrNil,
                                url: urlOrNil,
                                date: nil,
                                latitude: latitude,
                                longitude: longitude
                            )
                            modelContext.insert(newAccommodation)
                        }

                        try? modelContext.save()
                        dismiss()
                    }
                    .disabled(!canSave)
                }
            }
        }
        .sheet(isPresented: $showPickOnMap) {
            MapPinPickView(initialCoordinate: currentCoordinate()) { pickedCoordinate in
                latitude = pickedCoordinate.latitude
                longitude = pickedCoordinate.longitude
            }
        }
    }
}

